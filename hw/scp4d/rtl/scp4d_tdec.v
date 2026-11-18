// TEST ONLY. 4D-SCP v0.1.11 — synthesizable streaming decoder for the S4DI v1 temporal-only path.
`timescale 1ns/1ps
//
// Decodes an S4DI v1 stream (scripts/scp-v0110-int-scp4d.ts) made with rank 0 and relations off,
// for all three hold predictors: zero, last (event-driven: only event elements are touched) and
// linear. Output: integer codes c[t][e] (grid g = eps / 2^G), bit-exact with the v0.1.10 model.
// Streams using relations (u8 relations == 1) or a low-rank base (rank > 0) are REJECTED at the
// header with unsupported = 1 (out of scope for v0.1.11); they are never mis-decoded.
//
// Plain Verilog-2005. No floating point, no division, no hashing, no initial blocks.
// One stream byte per cycle at most (in_valid/in_ready). One output token per cycle at most; the
// consumer must accept every token (no output back-pressure in v0.1.11).
//
// Pipeline: front-end FSM (header + varint parse, event index walk) -> token register (A: state
// memory read) -> execute (B: predict, apply q·2^G, write state, emit). State memories H1, H2 are
// 2^ADDR_W x 32-bit simple dual-port (sync read). Adjacent tokens to the same element are
// forwarded. Memories are cleared (D cycles) in the background while the rest of the header
// streams in; the first payload byte waits for the clear to finish.
//
// Header varints (times, steps) are skipped, not accumulated (they are not needed to decode codes);
// the 8-byte / 2^53 bound of the model's reader is still enforced. Payload varints are limited to
// 5 bytes (35 bits) and q to signed 32 bits (declared widths: code 32, q 32); anything larger raises
// err rather than decoding wrongly.
`default_nettype none
module scp4d_tdec #(
  parameter integer ADDR_W = 11,   // max D = 2^ADDR_W elements per frame
  parameter integer G_MAX  = 16    // max deadband exponent accepted
) (
  input  wire                 clk,
  input  wire                 rst,          // synchronous, active high
  input  wire [7:0]           in_data,
  input  wire                 in_valid,
  output wire                 in_ready,
  output reg                  out_valid,    // element token: out_elem / out_code / out_event
  output reg  [ADDR_W-1:0]    out_elem,
  output reg  signed [31:0]   out_code,
  output reg                  out_event,
  output reg                  out_eof,      // frame complete (with or without an element token)
  output reg                  done,         // all T frames decoded and the pipeline drained
  output reg                  err,
  output reg                  unsupported,  // err because the stream is out of v0.1.11 scope
  output reg  [4:0]           err_code,
  output reg  [31:0]          hdr_T,
  output reg  [ADDR_W:0]      hdr_D,
  output reg  [4:0]           hdr_G,
  output reg  [1:0]           hdr_pred
);
  localparam [ADDR_W:0] MAXD = 1 << ADDR_W;

  // error codes
  localparam [4:0] E_MAGIC = 5'd1, E_VERSION = 5'd2, E_T0 = 5'd3, E_DSIZE = 5'd4, E_G = 5'd5,
                   E_HVARINT = 5'd6, E_VERDICT = 5'd7, E_RANK = 5'd8, E_REL = 5'd9, E_PRED = 5'd10,
                   E_FW = 5'd11, E_PVARINT = 5'd13, E_QWIDTH = 5'd14, E_QZERO = 5'd15,
                   E_INDEX = 5'd16, E_COUNT = 5'd17, E_OVF = 5'd18;

  localparam [4:0] S_FIX = 5'd0, S_EPS = 5'd1, S_G = 5'd2, S_TIMES = 5'd3, S_MFLAG = 5'd4,
                   S_STEPS = 5'd5, S_VERD = 5'd6, S_RANK = 5'd7, S_REL = 5'd8, S_PRED = 5'd9,
                   S_FW = 5'd10, S_LAYOUT = 5'd11, S_HEAD = 5'd12, S_DENSE = 5'd13,
                   S_SPFIRST = 5'd14, S_SPQ = 5'd15, S_SPGAP = 5'd16, S_SWEEP = 5'd17,
                   S_DRAIN = 5'd18, S_DONE = 5'd19, S_ERR = 5'd20;

  reg [4:0] state;

  // ---------------- header registers ----------------
  reg [4:0]          bidx;        // byte index inside the fixed part (0..16)
  reg [7:0]          fld_lo;
  reg [ADDR_W:0]     dacc;        // running product nx·ny·nz·C
  reg                dbig;
  reg [ADDR_W+3:0]   cnt;         // generic byte counter (eps bytes, verdict bytes)
  reg [ADDR_W+3:0]   eps_last;    // 8·C − 1
  reg [31:0]         vcount;      // header varints seen
  reg [2:0]          hvb;         // byte index inside a skipped header varint
  reg                all_dense;

  // ---------------- memory clear ----------------
  reg                clr_active, clr_done;
  reg [ADDR_W-1:0]   clr_cnt;

  // ---------------- frame walk ----------------
  reg [31:0]         fr;          // frame index
  reg [ADDR_W:0]     ei;          // element index (processing order == element order here)
  reg [ADDR_W:0]     nxt;         // next event element (D = none left)
  reg [ADDR_W:0]     left;        // sparse events still to read after the current one
  reg [ADDR_W:0]     fr_n;        // n from the frame head
  reg                nbig;
  reg [ADDR_W:0]     dcount;      // non-zero q in a dense frame

  // ---------------- payload varint unit ----------------
  reg [34:0]         vacc;
  reg [2:0]          vsh;

  wire mode_last = (hdr_pred == 2'd1);
  wire mode_lin  = (hdr_pred == 2'd2);
  wire sweep_mode = !mode_last;

  wire frame_state = (state == S_HEAD) || (state == S_DENSE) || (state == S_SPFIRST) ||
                     (state == S_SPQ) || (state == S_SPGAP);
  wire hdr_state = (state <= S_LAYOUT);
  assign in_ready = !rst && (hdr_state || (frame_state && clr_done));
  wire take = in_valid && in_ready;

  // varint assembly (combinational view of the byte being taken)
  reg [34:0] vshifted;
  always @(*) begin
    case (vsh)
      3'd0: vshifted = {28'd0, in_data[6:0]};
      3'd1: vshifted = {21'd0, in_data[6:0], 7'd0};
      3'd2: vshifted = {14'd0, in_data[6:0], 14'd0};
      3'd3: vshifted = {7'd0, in_data[6:0], 21'd0};
      default: vshifted = {in_data[6:0], 28'd0};
    endcase
  end
  wire [34:0] vfull = vacc | vshifted;
  wire        vend  = !in_data[7];           // last byte of this varint
  wire        vlong = in_data[7] && (vsh == 3'd4);

  // zigzag decode, q limited to signed 32 bits
  wire [33:0] qmag  = vfull[34:1];
  wire        qbig  = (qmag[33:31] != 3'd0);
  wire [31:0] q32   = vfull[0] ? ~qmag[31:0] : qmag[31:0];
  wire        qnz   = (q32 != 32'd0);

  // shape product (one 16 x (ADDR_W+1) multiplier, header only)
  wire [15:0]        fld   = {in_data, fld_lo};
  wire [ADDR_W+16:0] prod  = dacc * fld;
  wire               pbig  = dbig || (prod > {{16{1'b0}}, MAXD});

  // sparse index arithmetic
  wire [35:0] gap_next  = {{(35-ADDR_W){1'b0}}, ei} + {1'b0, vfull};
  wire        gap_oob   = (gap_next >= {{(35-ADDR_W){1'b0}}, hdr_D});
  wire        first_oob = ({1'b0, vfull} >= {{(35-ADDR_W){1'b0}}, hdr_D});

  // ---------------- token A (memory read) ----------------
  reg                tA_valid, tA_eof, tA_ev, tA_lin2;
  reg [ADDR_W-1:0]   tA_e;
  reg signed [31:0]  tA_q;
  // ---------------- token B (execute) ----------------
  reg                tB_valid, tB_eof, tB_ev, tB_lin2;
  reg [ADDR_W-1:0]   tB_e;
  reg signed [31:0]  tB_q;

  // state memories
  reg [31:0] mem_h1 [0:(1<<ADDR_W)-1];
  reg [31:0] mem_h2 [0:(1<<ADDR_W)-1];
  reg [31:0] rd_h1, rd_h2;
  reg        fwd1, fwd2;
  reg [31:0] fwd1_d, fwd2_d;

  wire signed [31:0] h1 = fwd1 ? fwd1_d : rd_h1;
  wire signed [31:0] h2 = fwd2 ? fwd2_d : rd_h2;
  wire signed [33:0] h1x = {{2{h1[31]}}, h1};
  wire signed [33:0] h2x = {{2{h2[31]}}, h2};
  wire signed [33:0] hold = mode_lin ? (tB_lin2 ? (h1x <<< 1) - h2x : h1x) : (mode_last ? h1x : 34'sd0);
  wire        hold_ovf = (hold[33:31] != 3'b000) && (hold[33:31] != 3'b111);
  wire signed [47:0] qx  = {{16{tB_q[31]}}, tB_q};
  wire signed [47:0] dq  = qx <<< hdr_G;
  wire signed [47:0] cn48 = {{14{hold[33]}}, hold} + (tB_ev ? dq : 48'sd0);
  wire        cn_ovf = (cn48[47:31] != 17'd0) && (cn48[47:31] != {17{1'b1}});
  wire [31:0] cnew  = cn48[31:0];
  wire        b_ovf = tB_valid && (hold_ovf || cn_ovf);

  wire        we1 = clr_active || (tB_valid && !b_ovf && ((mode_last && tB_ev) || mode_lin));
  wire        we2 = clr_active || (tB_valid && !b_ovf && mode_lin);
  wire [ADDR_W-1:0] waddr = clr_active ? clr_cnt : tB_e;
  wire [31:0] wd1 = clr_active ? 32'd0 : cnew;
  wire [31:0] wd2 = clr_active ? 32'd0 : h1;

  always @(posedge clk) begin
    if (we1) mem_h1[waddr] <= wd1;
    if (we2) mem_h2[waddr] <= wd2;
    rd_h1 <= mem_h1[tA_e];
    rd_h2 <= mem_h2[tA_e];
  end

  // ---------------- front end + pipeline control ----------------
  // token produced by the front end this cycle: combinational temporaries assigned with '=' inside
  // the clocked block and registered into token A at the end of it (lint waiver below).
  /* verilator lint_off BLKSEQ */
  reg               iss_valid, iss_eof, iss_ev;
  reg [ADDR_W-1:0]  iss_e;
  reg [31:0]        iss_q;

  task fail(input [4:0] code, input unsup);
    begin
      err <= 1'b1; unsupported <= unsup; err_code <= code; state <= S_ERR;
    end
  endtask

  task frame_advance;
    begin
      fr <= fr + 32'd1;
      ei <= {(ADDR_W+1){1'b0}};
      dcount <= {(ADDR_W+1){1'b0}};
      if (fr + 32'd1 == hdr_T) state <= S_DRAIN;
      else state <= all_dense ? S_DENSE : S_HEAD;
    end
  endtask

  always @(posedge clk) begin
    if (rst) begin
      state <= S_FIX; bidx <= 5'd0; fld_lo <= 8'd0; dacc <= {{ADDR_W{1'b0}}, 1'b1}; dbig <= 1'b0;
      cnt <= 0; eps_last <= 0; vcount <= 32'd0; hvb <= 3'd0; all_dense <= 1'b0;
      clr_active <= 1'b0; clr_done <= 1'b0; clr_cnt <= {ADDR_W{1'b0}};
      fr <= 32'd0; ei <= 0; nxt <= 0; left <= 0; fr_n <= 0; nbig <= 1'b0; dcount <= 0;
      vacc <= 35'd0; vsh <= 3'd0;
      tA_valid <= 1'b0; tA_eof <= 1'b0; tA_ev <= 1'b0; tA_lin2 <= 1'b0; tA_e <= 0; tA_q <= 32'sd0;
      tB_valid <= 1'b0; tB_eof <= 1'b0; tB_ev <= 1'b0; tB_lin2 <= 1'b0; tB_e <= 0; tB_q <= 32'sd0;
      fwd1 <= 1'b0; fwd2 <= 1'b0; fwd1_d <= 32'd0; fwd2_d <= 32'd0;
      out_valid <= 1'b0; out_elem <= 0; out_code <= 32'sd0; out_event <= 1'b0; out_eof <= 1'b0;
      done <= 1'b0; err <= 1'b0; unsupported <= 1'b0; err_code <= 5'd0;
      hdr_T <= 32'd0; hdr_D <= 0; hdr_G <= 5'd0; hdr_pred <= 2'd0;
    end else begin
      // defaults
      iss_valid = 1'b0; iss_eof = 1'b0; iss_ev = 1'b0; iss_e = {ADDR_W{1'b0}}; iss_q = 32'd0;

      // background memory clear
      if (clr_active) begin
        clr_cnt <= clr_cnt + 1'b1;
        if ({1'b0, clr_cnt} == hdr_D - 1'b1) begin clr_active <= 1'b0; clr_done <= 1'b1; end
      end

      // payload varint accumulation (shared by every payload state)
      if (take && frame_state) begin
        if (vend) begin vacc <= 35'd0; vsh <= 3'd0; end
        else if (!vlong) begin vacc <= vfull; vsh <= vsh + 3'd1; end
      end

      case (state)
        S_FIX: if (take) begin
          bidx <= bidx + 5'd1;
          case (bidx)
            5'd0: if (in_data != 8'h53) fail(E_MAGIC, 1'b0);
            5'd1: if (in_data != 8'h34) fail(E_MAGIC, 1'b0);
            5'd2: if (in_data != 8'h44) fail(E_MAGIC, 1'b0);
            5'd3: if (in_data != 8'h49) fail(E_MAGIC, 1'b0);
            5'd4: if (in_data != 8'h01) fail(E_VERSION, 1'b0);
            5'd5: hdr_T[7:0]   <= in_data;
            5'd6: hdr_T[15:8]  <= in_data;
            5'd7: hdr_T[23:16] <= in_data;
            5'd8: hdr_T[31:24] <= in_data;
            5'd9, 5'd11, 5'd13, 5'd15: fld_lo <= in_data;
            5'd10, 5'd12, 5'd14: begin dbig <= pbig; dacc <= prod[ADDR_W:0]; end
            default: begin // 16: high byte of C
              if (hdr_T == 32'd0) fail(E_T0, 1'b1);
              else if (pbig || prod == 0) fail(E_DSIZE, 1'b1);
              else begin
                hdr_D <= prod[ADDR_W:0];
                eps_last <= {fld[ADDR_W:0], 3'b000} - 1'b1;   // 8·C − 1 (C ≤ D ≤ 2^ADDR_W)
                cnt <= 0;
                clr_active <= 1'b1; clr_cnt <= {ADDR_W{1'b0}};
                state <= S_EPS;
              end
            end
          endcase
        end
        S_EPS: if (take) begin
          cnt <= cnt + 1'b1;
          if (cnt == eps_last) state <= S_G;
        end
        S_G: if (take) begin
          if ({24'd0, in_data} > G_MAX) fail(E_G, 1'b1);
          else begin hdr_G <= in_data[4:0]; vcount <= 32'd0; hvb <= 3'd0; state <= S_TIMES; end
        end
        S_TIMES, S_STEPS: if (take) begin
          if (in_data[7]) begin
            if (hvb == 3'd7) fail(E_HVARINT, 1'b0);
            else hvb <= hvb + 3'd1;
          end else begin
            if (hvb == 3'd7 && in_data[6:4] != 3'd0) fail(E_HVARINT, 1'b0);   // > 2^53 − 1
            else begin
              hvb <= 3'd0; vcount <= vcount + 32'd1;
              if (vcount + 32'd1 == hdr_T) begin
                vcount <= 32'd0;
                if (state == S_TIMES) state <= S_MFLAG;
                else begin cnt <= 0; state <= S_VERD; end
              end
            end
          end
        end
        S_MFLAG: if (take) begin
          state <= (in_data == 8'd1) ? S_STEPS : S_RANK;
        end
        S_VERD: if (take) begin
          if (in_data > 8'd2) fail(E_VERDICT, 1'b0);
          else begin
            vcount <= vcount + 32'd1;
            if (vcount + 32'd1 == hdr_T) state <= S_RANK;
          end
        end
        S_RANK: if (take) begin
          if (in_data != 8'd0) fail(E_RANK, 1'b1); else state <= S_REL;
        end
        S_REL: if (take) begin
          if (in_data == 8'd1) fail(E_REL, 1'b1); else state <= S_PRED;
        end
        S_PRED: if (take) begin
          if (in_data > 8'd2) fail(E_PRED, 1'b0);
          else begin hdr_pred <= in_data[1:0]; state <= S_FW; end
        end
        S_FW: if (take) begin
          if (in_data != 8'd16) fail(E_FW, 1'b0); else state <= S_LAYOUT;
        end
        S_LAYOUT: if (take) begin
          all_dense <= (in_data == 8'd1);
          fr <= 32'd0; ei <= 0; dcount <= 0;
          state <= (in_data == 8'd1) ? S_DENSE : S_HEAD;
        end

        S_HEAD: if (take) begin
          if (vlong) fail(E_PVARINT, 1'b0);
          else if (vend) begin
            fr_n <= vfull[ADDR_W+1:1];
            nbig <= (vfull[34:1] > {{(34-ADDR_W-1){1'b0}}, hdr_D});
            dcount <= 0; ei <= 0;
            if (vfull[0]) state <= S_DENSE;
            else if (vfull[34:1] == 34'd0) begin
              if (mode_last) begin iss_eof = 1'b1; frame_advance; end
              else begin nxt <= hdr_D; state <= S_SWEEP; end
            end else if (vfull[34:1] > {{(34-ADDR_W-1){1'b0}}, hdr_D}) fail(E_INDEX, 1'b0);
            else begin left <= vfull[ADDR_W+1:1] - 1'b1; state <= S_SPFIRST; end
          end
        end
        S_SPFIRST: if (take) begin
          if (vlong) fail(E_PVARINT, 1'b0);
          else if (vend) begin
            if (first_oob) fail(E_INDEX, 1'b0);
            else begin
              nxt <= vfull[ADDR_W:0];
              state <= (sweep_mode && vfull[ADDR_W:0] != ei) ? S_SWEEP : S_SPQ;
            end
          end
        end
        S_SWEEP: begin
          iss_valid = 1'b1; iss_e = ei[ADDR_W-1:0]; iss_q = 32'd0; iss_ev = 1'b0;
          iss_eof = (ei == hdr_D - 1'b1);
          ei <= ei + 1'b1;
          if (ei + 1'b1 == nxt) begin
            if (nxt == hdr_D) frame_advance;
            else state <= S_SPQ;
          end
        end
        S_SPQ: if (take) begin
          if (vlong) fail(E_PVARINT, 1'b0);
          else if (vend) begin
            if (qbig) fail(E_QWIDTH, 1'b0);
            else if (!qnz) fail(E_QZERO, 1'b0);
            else begin
              iss_valid = 1'b1; iss_e = nxt[ADDR_W-1:0]; iss_q = q32; iss_ev = 1'b1;
              iss_eof = mode_last ? (left == 0) : (left == 0 && nxt == hdr_D - 1'b1);
              ei <= nxt + 1'b1;
              if (left != 0) state <= S_SPGAP;
              else if (iss_eof) frame_advance;
              else begin nxt <= hdr_D; state <= S_SWEEP; end
            end
          end
        end
        S_SPGAP: if (take) begin
          if (vlong) fail(E_PVARINT, 1'b0);
          else if (vend) begin
            if (gap_oob) fail(E_INDEX, 1'b0);
            else begin
              nxt <= gap_next[ADDR_W:0];
              left <= left - 1'b1;
              state <= (sweep_mode && gap_next[ADDR_W:0] != ei) ? S_SWEEP : S_SPQ;
            end
          end
        end
        S_DENSE: if (take) begin
          if (vlong) fail(E_PVARINT, 1'b0);
          else if (vend) begin
            if (qbig) fail(E_QWIDTH, 1'b0);
            else begin
              iss_valid = sweep_mode || qnz; iss_e = ei[ADDR_W-1:0]; iss_q = q32; iss_ev = qnz;
              iss_eof = (ei == hdr_D - 1'b1);
              ei <= ei + 1'b1;
              dcount <= dcount + qnz;
              if (iss_eof) begin
                if (!all_dense && (nbig || (dcount + qnz) != fr_n)) fail(E_COUNT, 1'b0);
                else frame_advance;
              end
            end
          end
        end
        S_DRAIN: if (!tA_valid && !tA_eof && !tB_valid && !tB_eof) begin done <= 1'b1; state <= S_DONE; end
        default: ;
      endcase

      // ---- pipeline: issue -> A -> B -> out ----
      tA_valid <= iss_valid; tA_eof <= iss_eof; tA_ev <= iss_ev; tA_e <= iss_e; tA_q <= iss_q;
      tA_lin2 <= (fr >= 32'd2);
      tB_valid <= tA_valid; tB_eof <= tA_eof; tB_ev <= tA_ev; tB_e <= tA_e; tB_q <= tA_q; tB_lin2 <= tA_lin2;
      fwd1 <= we1 && !clr_active && tA_valid && (tA_e == tB_e);
      fwd2 <= we2 && !clr_active && tA_valid && (tA_e == tB_e);
      fwd1_d <= wd1; fwd2_d <= wd2;

      out_valid <= tB_valid && !b_ovf;
      out_elem  <= tB_e;
      out_code  <= cnew;
      out_event <= tB_ev;
      out_eof   <= tB_eof && !b_ovf;
      if (b_ovf) fail(E_OVF, 1'b0);
    end
  end
  /* verilator lint_on BLKSEQ */
endmodule
`default_nettype wire

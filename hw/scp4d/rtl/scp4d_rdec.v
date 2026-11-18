// TEST ONLY. 4D-SCP v0.1.12 — synthesizable event-driven decoder for S4DI v1 with declared relations.
`timescale 1ns/1ps
//
// Decodes S4DI v1 streams (scripts/scp-v0110-int-scp4d.ts) made with rank 0 and the last-value
// hold, with relations on (u8 relations == 1) or off. Output: integer codes c[t][e] (grid
// g = eps / 2^G), bit-exact with the v0.1.10 model. It is the event-driven counterpart of
// scp4d_tdec.v (v0.1.11, unchanged): with relations off it decodes exactly like scp4d_tdec in
// last-value mode. Out of scope, REJECTED at the header with unsupported = 1 (never mis-decoded):
// rank > 0 (E_RANK) and any predictor other than the last-value hold (E_HOLD; zero / linear
// temporal-only streams are decoded by scp4d_tdec).
//
// Relation program (out of band, like the model's declared schema): loaded through the cfg_*
// port before the stream (while rst is high), by a host that ran the model's fixed-point setup
// (fixRelations + makePlan). Tables:
//   ORD[i]  processing position i -> {is_target, element e, aux, fan_cnt}; aux = relation index ti
//           for a target, start of the element's fan-out list for a non-target source.
//   FAN[j]  fan-out entry {target element tg, relation index ti, weight W (18-bit signed, Q16)}.
//   ACC[ti] 48-bit accumulator, loaded with the relation bias (Q16).
//   regs    prog_d (D the program was built for), prog_nt (relation count).
// A target must not be a source (the generator enforces it).
//
// Datapath (per frame; the model's decodeFramesEventDriven, in hardware):
//   non-target event:  H1[e] += q·2^G, emit (e, H1[e]); if e is a source, then for each fan-out
//                      entry: ACC[ti] += W·q·2^G (one entry per cycle, the byte parser stalls) and
//                      mark ti dirty.
//   target event:      H1[tg] += q·2^G (hold residual); mark ti dirty with its event flag.
//   frame end:         wait FW = 4 cycles for the marks to settle, then for each dirty target
//                      (frame 0: every target) emit (tg, ((ACC[ti] + 2^15) >>> 16) + H1[tg]).
// Pipeline: front end (header/varint parse, ORD/FAN/LIST prefetch) -> M (W·q multiply) ->
// A (memory read, << G) -> B (execute, write, emit). Memories are simple dual-port, sync read;
// back-to-back read-after-write to the same address is forwarded. Every arithmetic result is range
// checked against its declared width (code 32, rel_product 48, rel_acc 48): overflow -> E_OVF.
//
// Plain Verilog-2005. No floating point, no division, no hashing, no initial blocks.
// One stream byte per cycle at most (in_valid/in_ready). One output token per cycle at most; the
// consumer must accept every token (no output back-pressure).
`default_nettype none
module scp4d_rdec #(
  parameter integer ADDR_W = 11,   // max D = 2^ADDR_W elements per frame
  parameter integer REL_W  = 10,   // max relations = 2^REL_W
  parameter integer FAN_W  = 11,   // max fan-out entries = 2^FAN_W
  parameter integer FC_W   = 4,    // max fan-out entries per source = 2^FC_W - 1
  parameter integer G_MAX  = 16    // max deadband exponent accepted
) (
  input  wire                 clk,
  input  wire                 rst,          // synchronous, active high
  // relation program load (only while rst is high)
  input  wire                 cfg_we,
  input  wire [1:0]           cfg_sel,      // 0 ORD, 1 FAN, 2 ACC, 3 regs (addr 0: prog_d, 1: prog_nt)
  input  wire [15:0]          cfg_addr,
  input  wire [47:0]          cfg_data,
  // stream
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
  output reg                  unsupported,  // err because the stream is out of scope
  output reg  [4:0]           err_code,
  output reg  [31:0]          hdr_T,
  output reg  [ADDR_W:0]      hdr_D,
  output reg  [4:0]           hdr_G,
  output reg                  hdr_rel
);
  localparam [ADDR_W:0] MAXD = 1 << ADDR_W;
  localparam integer AUX_W = (REL_W > FAN_W) ? REL_W : FAN_W;
  localparam integer ORD_W = 1 + ADDR_W + AUX_W + FC_W;
  localparam integer FAN_E = ADDR_W + REL_W + 18;
  localparam integer LST_E = ADDR_W + REL_W;
  localparam [2:0]  FW_LAST = 3'd3;         // frame-end settle: FW = 4 cycles (0..3)

  // error codes (1..18 as scp4d_tdec)
  localparam [4:0] E_MAGIC = 5'd1, E_VERSION = 5'd2, E_T0 = 5'd3, E_DSIZE = 5'd4, E_G = 5'd5,
                   E_HVARINT = 5'd6, E_VERDICT = 5'd7, E_RANK = 5'd8, E_PRED = 5'd10,
                   E_FW = 5'd11, E_PVARINT = 5'd13, E_QWIDTH = 5'd14, E_QZERO = 5'd15,
                   E_INDEX = 5'd16, E_COUNT = 5'd17, E_OVF = 5'd18, E_HOLD = 5'd19, E_PROG = 5'd20;

  localparam [4:0] S_FIX = 5'd0, S_EPS = 5'd1, S_G = 5'd2, S_TIMES = 5'd3, S_MFLAG = 5'd4,
                   S_STEPS = 5'd5, S_VERD = 5'd6, S_RANK = 5'd7, S_REL = 5'd8, S_PRED = 5'd9,
                   S_FW = 5'd10, S_LAYOUT = 5'd11, S_HEAD = 5'd12, S_DENSE = 5'd13,
                   S_SPFIRST = 5'd14, S_SPQ = 5'd15, S_SPGAP = 5'd16, S_FAN = 5'd17,
                   S_DRAIN = 5'd18, S_DONE = 5'd19, S_ERR = 5'd20, S_FWAIT = 5'd21,
                   S_FLIST = 5'd22, S_F0 = 5'd23;

  // op kinds
  localparam [1:0] K_NT = 2'd0, K_FAN = 2'd1, K_TGT = 2'd2, K_FLUSH = 2'd3;

  reg [4:0] state;

  // ---------------- header registers ----------------
  reg [4:0]          bidx;
  reg [7:0]          fld_lo;
  reg [ADDR_W:0]     dacc;
  reg                dbig;
  reg [ADDR_W+3:0]   cnt;
  reg [ADDR_W+3:0]   eps_last;
  reg [31:0]         vcount;
  reg [2:0]          hvb;
  reg                all_dense;

  // ---------------- relation program registers ----------------
  reg [ADDR_W:0]     prog_d;
  reg [REL_W:0]      prog_nt;
  reg [ADDR_W:0]     prog_nnt;     // D − nT: first target position

  // ---------------- memory clear ----------------
  reg                clr_active, clr_done;
  reg [ADDR_W-1:0]   clr_cnt;

  // ---------------- frame walk ----------------
  reg [31:0]         fr;
  reg [ADDR_W:0]     ei;
  reg [ADDR_W:0]     nxt;
  reg [ADDR_W:0]     left;
  reg [ADDR_W:0]     fr_n;
  reg                nbig;
  reg [ADDR_W:0]     dcount;
  reg [4:0]          ret_state;    // where S_FAN returns to
  reg [FC_W-1:0]     fan_left;
  reg [FAN_W-1:0]    fan_ptr;
  reg signed [31:0]  fan_q;
  reg [2:0]          wcnt;
  reg [ADDR_W:0]     opos;         // address of the ORD word in rd_ord
  reg [REL_W:0]      lpos;         // LIST walk position
  reg [REL_W:0]      wptr;         // LIST length (written by stage B)

  // ---------------- payload varint unit ----------------
  reg [34:0]         vacc;
  reg [2:0]          vsh;

  wire frame_state = (state == S_HEAD) || (state == S_DENSE) || (state == S_SPFIRST) ||
                     (state == S_SPQ) || (state == S_SPGAP);
  wire hdr_state = (state <= S_LAYOUT);
  assign in_ready = !rst && (hdr_state || (frame_state && clr_done));
  wire take = in_valid && in_ready;

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
  wire        vend  = !in_data[7];
  wire        vlong = in_data[7] && (vsh == 3'd4);

  wire [33:0] qmag  = vfull[34:1];
  wire        qbig  = (qmag[33:31] != 3'd0);
  wire [31:0] q32   = vfull[0] ? ~qmag[31:0] : qmag[31:0];
  wire        qnz   = (q32 != 32'd0);

  wire [15:0]        fld   = {in_data, fld_lo};
  wire [ADDR_W+16:0] prod  = dacc * fld;
  wire               pbig  = dbig || (prod > {{16{1'b0}}, MAXD});

  wire [35:0] gap_next  = {{(35-ADDR_W){1'b0}}, ei} + {1'b0, vfull};
  wire        gap_oob   = (gap_next >= {{(35-ADDR_W){1'b0}}, hdr_D});
  wire        first_oob = ({1'b0, vfull} >= {{(35-ADDR_W){1'b0}}, hdr_D});

  // ---------------- program memories (front-end read ports) ----------------
  reg [ORD_W-1:0] mem_ord [0:(1<<ADDR_W)-1];
  reg [FAN_E-1:0] mem_fan [0:(1<<FAN_W)-1];
  reg [LST_E-1:0] mem_lst [0:(1<<REL_W)-1];
  reg [ORD_W-1:0] rd_ord;
  reg [FAN_E-1:0] rd_fan;
  reg [LST_E-1:0] rd_lst;
  wire               o_tgt = rd_ord[ORD_W-1];
  wire [ADDR_W-1:0]  o_e   = rd_ord[ORD_W-2 -: ADDR_W];
  wire [AUX_W-1:0]   o_aux = rd_ord[FC_W +: AUX_W];
  wire [FC_W-1:0]    o_cnt = rd_ord[FC_W-1:0];
  wire [ADDR_W-1:0]  f_tg  = rd_fan[FAN_E-1 -: ADDR_W];
  wire [REL_W-1:0]   f_ti  = rd_fan[18 +: REL_W];
  wire [17:0]        f_w   = rd_fan[17:0];
  wire [ADDR_W-1:0]  l_tg  = rd_lst[LST_E-1 -: ADDR_W];
  wire [REL_W-1:0]   l_ti  = rd_lst[REL_W-1:0];

  // ---------------- pipeline registers ----------------
  // M: multiply
  reg                tM_valid, tM_eof;
  reg [1:0]          tM_k;
  reg [ADDR_W-1:0]   tM_e;
  reg [REL_W-1:0]    tM_ti;
  reg signed [31:0]  tM_q;
  reg signed [17:0]  tM_w;
  // A: memory read, << G
  reg                tA_valid, tA_eof;
  reg [1:0]          tA_k;
  reg [ADDR_W-1:0]   tA_e;
  reg [REL_W-1:0]    tA_ti;
  reg signed [31:0]  tA_q;
  reg signed [49:0]  tA_prod;
  // B: execute
  reg                tB_valid, tB_eof;
  reg [1:0]          tB_k;
  reg [ADDR_W-1:0]   tB_e;
  reg [REL_W-1:0]    tB_ti;
  reg signed [31:0]  tB_q;
  reg signed [47:0]  tB_pd;
  reg                tB_pdovf;

  wire signed [49:0] m_prod = tM_w * tM_q;            // 18 x 32 signed
  wire signed [65:0] a_px   = {{16{tA_prod[49]}}, tA_prod} <<< hdr_G;
  wire               a_povf = (a_px[65:47] != 19'd0) && (a_px[65:47] != {19{1'b1}});

  // state memories
  reg [31:0] mem_h1  [0:(1<<ADDR_W)-1];
  reg [47:0] mem_acc [0:(1<<REL_W)-1];
  reg [1:0]  mem_dst [0:(1<<REL_W)-1];              // {dirty, event}
  reg [31:0] rd_h1;
  reg [47:0] rd_acc;
  reg [1:0]  rd_dst;
  reg        fwd1, fwda, fwdd;
  reg [31:0] fwd1_d;
  reg [47:0] fwda_d;
  reg [1:0]  fwdd_d;

  wire signed [31:0] h1  = fwd1 ? fwd1_d : rd_h1;
  wire signed [47:0] acc = fwda ? fwda_d : rd_acc;
  wire [1:0]         dst = fwdd ? fwdd_d : rd_dst;

  wire b_nt = tB_valid && (tB_k == K_NT), b_fan = tB_valid && (tB_k == K_FAN);
  wire b_tgt = tB_valid && (tB_k == K_TGT), b_fl = tB_valid && (tB_k == K_FLUSH);

  // NT / TGT: h1 + q·2^G
  wire signed [47:0] qx   = {{16{tB_q[31]}}, tB_q};
  wire signed [47:0] dq   = qx <<< hdr_G;
  wire signed [47:0] cn48 = {{16{h1[31]}}, h1} + dq;
  wire        cn_ovf = (cn48[47:31] != 17'd0) && (cn48[47:31] != {17{1'b1}});
  // FAN: ACC + W·q·2^G
  wire signed [48:0] an49 = {acc[47], acc} + {tB_pd[47], tB_pd};
  wire        an_ovf = (an49[48] != an49[47]);
  // FLUSH: ((ACC + 2^15) >>> 16) + H1
  /* verilator lint_off UNUSEDSIGNAL */
  wire signed [48:0] ar49 = {acc[47], acc} + 49'sd32768;   // bits [15:0] dropped by the >>> 16
  /* verilator lint_on UNUSEDSIGNAL */
  wire        ar_ovf = (ar49[48] != ar49[47]);
  wire signed [32:0] fc33 = {ar49[47], ar49[47:16]} + {h1[31], h1};
  wire        fc_ovf = (fc33[32] != fc33[31]);

  wire b_ovf = ((b_nt || b_tgt) && cn_ovf) || (b_fan && (tB_pdovf || an_ovf)) || (b_fl && (ar_ovf || fc_ovf));
  wire b_ok  = !b_ovf;

  wire        we1  = clr_active || ((b_nt || b_tgt) && b_ok);
  wire [ADDR_W-1:0] w1a = clr_active ? clr_cnt : tB_e;
  wire [31:0] wd1  = clr_active ? 32'd0 : cn48[31:0];
  wire        wea  = b_fan && b_ok;
  wire        wed  = clr_active || ((b_fan || b_tgt || b_fl) && b_ok);
  wire [REL_W-1:0] wda_a = clr_active ? clr_cnt[REL_W-1:0] : tB_ti;
  wire [1:0]  wdd  = (clr_active || b_fl) ? 2'b00 : {1'b1, (b_tgt ? 1'b1 : dst[0])};
  wire        wel  = (b_fan || b_tgt) && b_ok && !dst[1];

  // program load / datapath write ports (one write port per memory)
  always @(posedge clk) begin
    if (rst && cfg_we && cfg_sel == 2'd0) mem_ord[cfg_addr[ADDR_W-1:0]] <= cfg_data[ORD_W-1:0];
    if (rst && cfg_we && cfg_sel == 2'd1) mem_fan[cfg_addr[FAN_W-1:0]] <= cfg_data[FAN_E-1:0];
    if (rst && cfg_we && cfg_sel == 2'd2) mem_acc[cfg_addr[REL_W-1:0]] <= cfg_data;
    else if (wea) mem_acc[tB_ti] <= an49[47:0];
    if (we1) mem_h1[w1a] <= wd1;
    if (wed) mem_dst[wda_a] <= wdd;
    if (wel) mem_lst[wptr[REL_W-1:0]] <= {tB_e, tB_ti};
    rd_h1  <= mem_h1[tA_e];
    rd_acc <= mem_acc[tA_ti];
    rd_dst <= mem_dst[tA_ti];
  end

  /* verilator lint_off BLKSEQ */
  reg               iss_valid, iss_eof;
  reg [1:0]         iss_k;
  reg [ADDR_W-1:0]  iss_e;
  reg [REL_W-1:0]   iss_ti;
  reg [31:0]        iss_q;
  reg [17:0]        iss_w;
  reg [ADDR_W:0]    opos_n;
  reg [FAN_W-1:0]   fan_ra;
  reg [REL_W-1:0]   lst_ra;

  task fail(input [4:0] code, input unsup);
    begin
      err <= 1'b1; unsupported <= unsup; err_code <= code; state <= S_ERR;
    end
  endtask

  task frame_advance;
    begin
      fr <= fr + 32'd1;
      ei <= {(ADDR_W+1){1'b0}};
      opos_n = {(ADDR_W+1){1'b0}};
      dcount <= {(ADDR_W+1){1'b0}};
      wptr <= {(REL_W+1){1'b0}};
      if (fr + 32'd1 == hdr_T) state <= S_DRAIN;
      else state <= all_dense ? S_DENSE : S_HEAD;
    end
  endtask

  // end of a frame's payload: relations -> settle + flush; otherwise eof now (as scp4d_tdec)
  task frame_end;
    begin
      if (hdr_rel) begin wcnt <= 3'd0; state <= S_FWAIT; end
      else begin iss_eof = 1'b1; frame_advance; end
    end
  endtask

  // issue the event at processing position p (ORD word already in rd_ord); returns via S_FAN
  task issue_event(input [ADDR_W-1:0] p, input [31:0] q, input last_in_frame, input [4:0] cont);
    begin
      iss_valid = 1'b1; iss_q = q;
      if (!hdr_rel) begin
        iss_k = K_NT; iss_e = p;
        if (last_in_frame) iss_eof = 1'b1;
        if (last_in_frame) frame_advance; else if (cont != S_FWAIT) state <= cont;
      end else if (o_tgt) begin
        iss_k = K_TGT; iss_e = o_e; iss_ti = o_aux[REL_W-1:0];
        if (last_in_frame) frame_end; else state <= cont;
      end else begin
        iss_k = K_NT; iss_e = o_e;
        if (o_cnt != {FC_W{1'b0}}) begin
          fan_left <= o_cnt; fan_ptr <= o_aux[FAN_W-1:0]; fan_ra = o_aux[FAN_W-1:0]; fan_q <= q;
          ret_state <= last_in_frame ? S_FWAIT : cont;
          state <= S_FAN;
        end else if (last_in_frame) frame_end;
        else state <= cont;
      end
    end
  endtask

  always @(posedge clk) begin
    if (rst) begin
      state <= S_FIX; bidx <= 5'd0; fld_lo <= 8'd0; dacc <= {{ADDR_W{1'b0}}, 1'b1}; dbig <= 1'b0;
      cnt <= 0; eps_last <= 0; vcount <= 32'd0; hvb <= 3'd0; all_dense <= 1'b0;
      clr_active <= 1'b0; clr_done <= 1'b0; clr_cnt <= {ADDR_W{1'b0}};
      fr <= 32'd0; ei <= 0; nxt <= 0; left <= 0; fr_n <= 0; nbig <= 1'b0; dcount <= 0;
      ret_state <= S_HEAD; fan_left <= 0; fan_ptr <= 0; fan_q <= 32'sd0; wcnt <= 3'd0;
      opos <= 0; lpos <= 0; wptr <= 0;
      vacc <= 35'd0; vsh <= 3'd0;
      tM_valid <= 1'b0; tM_eof <= 1'b0; tM_k <= K_NT; tM_e <= 0; tM_ti <= 0; tM_q <= 32'sd0; tM_w <= 18'sd0;
      tA_valid <= 1'b0; tA_eof <= 1'b0; tA_k <= K_NT; tA_e <= 0; tA_ti <= 0; tA_q <= 32'sd0; tA_prod <= 50'sd0;
      tB_valid <= 1'b0; tB_eof <= 1'b0; tB_k <= K_NT; tB_e <= 0; tB_ti <= 0; tB_q <= 32'sd0; tB_pd <= 48'sd0; tB_pdovf <= 1'b0;
      fwd1 <= 1'b0; fwda <= 1'b0; fwdd <= 1'b0; fwd1_d <= 32'd0; fwda_d <= 48'd0; fwdd_d <= 2'd0;
      out_valid <= 1'b0; out_elem <= 0; out_code <= 32'sd0; out_event <= 1'b0; out_eof <= 1'b0;
      done <= 1'b0; err <= 1'b0; unsupported <= 1'b0; err_code <= 5'd0;
      hdr_T <= 32'd0; hdr_D <= 0; hdr_G <= 5'd0; hdr_rel <= 1'b0;
      if (cfg_we && cfg_sel == 2'd3 && cfg_addr == 16'd0) prog_d <= cfg_data[ADDR_W:0];
      if (cfg_we && cfg_sel == 2'd3 && cfg_addr == 16'd1) prog_nt <= cfg_data[REL_W:0];
    end else begin
      iss_valid = 1'b0; iss_eof = 1'b0; iss_k = K_NT; iss_e = {ADDR_W{1'b0}}; iss_ti = {REL_W{1'b0}};
      iss_q = 32'd0; iss_w = 18'd0;
      opos_n = opos; fan_ra = fan_ptr; lst_ra = lpos[REL_W-1:0];

      if (clr_active) begin
        clr_cnt <= clr_cnt + 1'b1;
        if ({1'b0, clr_cnt} == hdr_D - 1'b1) begin clr_active <= 1'b0; clr_done <= 1'b1; end
      end

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
            default: begin
              if (hdr_T == 32'd0) fail(E_T0, 1'b1);
              else if (pbig || prod == 0) fail(E_DSIZE, 1'b1);
              else begin
                hdr_D <= prod[ADDR_W:0];
                eps_last <= {fld[ADDR_W:0], 3'b000} - 1'b1;
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
            if (hvb == 3'd7 && in_data[6:4] != 3'd0) fail(E_HVARINT, 1'b0);
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
          hdr_rel <= (in_data == 8'd1); state <= S_PRED;
        end
        S_PRED: if (take) begin
          if (in_data > 8'd2) fail(E_PRED, 1'b0);
          else if (in_data != 8'd1) fail(E_HOLD, 1'b1);
          else if (hdr_rel && (prog_nt == 0 || prog_d != hdr_D)) fail(E_PROG, 1'b0);
          else begin prog_nnt <= hdr_D - {{(ADDR_W-REL_W){1'b0}}, prog_nt}; state <= S_FW; end
        end
        S_FW: if (take) begin
          if (in_data != 8'd16) fail(E_FW, 1'b0); else state <= S_LAYOUT;
        end
        S_LAYOUT: if (take) begin
          all_dense <= (in_data == 8'd1);
          fr <= 32'd0; ei <= 0; dcount <= 0; opos_n = 0; wptr <= 0;
          state <= (in_data == 8'd1) ? S_DENSE : S_HEAD;
        end

        S_HEAD: if (take) begin
          if (vlong) fail(E_PVARINT, 1'b0);
          else if (vend) begin
            fr_n <= vfull[ADDR_W+1:1];
            nbig <= (vfull[34:1] > {{(34-ADDR_W-1){1'b0}}, hdr_D});
            dcount <= 0; ei <= 0;
            if (vfull[0]) state <= S_DENSE;
            else if (vfull[34:1] == 34'd0) frame_end;
            else if (vfull[34:1] > {{(34-ADDR_W-1){1'b0}}, hdr_D}) fail(E_INDEX, 1'b0);
            else begin left <= vfull[ADDR_W+1:1] - 1'b1; state <= S_SPFIRST; end
          end
        end
        S_SPFIRST: if (take) begin
          if (vlong) fail(E_PVARINT, 1'b0);
          else if (vend) begin
            if (first_oob) fail(E_INDEX, 1'b0);
            else begin nxt <= vfull[ADDR_W:0]; opos_n = vfull[ADDR_W:0]; state <= S_SPQ; end
          end
        end
        S_SPQ: if (take) begin
          if (vlong) fail(E_PVARINT, 1'b0);
          else if (vend) begin
            if (qbig) fail(E_QWIDTH, 1'b0);
            else if (!qnz) fail(E_QZERO, 1'b0);
            else begin
              ei <= nxt + 1'b1;
              issue_event(nxt[ADDR_W-1:0], q32, left == 0, S_SPGAP);
            end
          end
        end
        S_SPGAP: if (take) begin
          if (vlong) fail(E_PVARINT, 1'b0);
          else if (vend) begin
            if (gap_oob) fail(E_INDEX, 1'b0);
            else begin
              nxt <= gap_next[ADDR_W:0]; opos_n = gap_next[ADDR_W:0];
              left <= left - 1'b1;
              state <= S_SPQ;
            end
          end
        end
        S_DENSE: if (take) begin
          if (vlong) fail(E_PVARINT, 1'b0);
          else if (vend) begin
            if (qbig) fail(E_QWIDTH, 1'b0);
            else begin
              ei <= ei + 1'b1; opos_n = ei + 1'b1;
              dcount <= dcount + qnz;
              if (ei == hdr_D - 1'b1) begin
                if (!all_dense && (nbig || (dcount + qnz) != fr_n)) fail(E_COUNT, 1'b0);
                else if (qnz) issue_event(ei[ADDR_W-1:0], q32, 1'b1, S_DENSE);
                else frame_end;
              end else if (qnz) issue_event(ei[ADDR_W-1:0], q32, 1'b0, S_DENSE);
            end
          end
        end
        S_FAN: begin
          iss_valid = 1'b1; iss_k = K_FAN; iss_e = f_tg; iss_ti = f_ti; iss_w = f_w; iss_q = fan_q;
          fan_left <= fan_left - 1'b1;
          fan_ptr <= fan_ptr + 1'b1; fan_ra = fan_ptr + 1'b1;
          if (fan_left == {{(FC_W-1){1'b0}}, 1'b1}) begin
            if (ret_state == S_FWAIT) begin wcnt <= 3'd0; state <= S_FWAIT; end
            else state <= ret_state;
          end
        end
        S_FWAIT: begin
          opos_n = prog_nnt; lst_ra = {REL_W{1'b0}};
          wcnt <= wcnt + 3'd1;
          if (wcnt == FW_LAST) begin
            if (fr == 32'd0) state <= S_F0;
            else if (wptr == 0) begin iss_eof = 1'b1; frame_advance; end
            else begin lpos <= 0; state <= S_FLIST; end
          end
        end
        S_F0: begin
          iss_valid = 1'b1; iss_k = K_FLUSH; iss_e = o_e; iss_ti = o_aux[REL_W-1:0];
          opos_n = opos + 1'b1;
          if (opos == hdr_D - 1'b1) begin iss_eof = 1'b1; frame_advance; end
        end
        S_FLIST: begin
          iss_valid = 1'b1; iss_k = K_FLUSH; iss_e = l_tg; iss_ti = l_ti;
          lpos <= lpos + 1'b1; lst_ra = lpos[REL_W-1:0] + 1'b1;
          if (lpos + 1'b1 == wptr) begin iss_eof = 1'b1; frame_advance; end
        end
        S_DRAIN: if (!tM_valid && !tM_eof && !tA_valid && !tA_eof && !tB_valid && !tB_eof) begin done <= 1'b1; state <= S_DONE; end
        default: ;
      endcase

      // ---- front-end prefetch (sync-read program memories) ----
      opos <= opos_n;
      rd_ord <= mem_ord[opos_n[ADDR_W-1:0]];
      rd_fan <= mem_fan[fan_ra];
      rd_lst <= mem_lst[lst_ra];

      // ---- pipeline: issue -> M -> A -> B -> out ----
      tM_valid <= iss_valid; tM_eof <= iss_eof; tM_k <= iss_k; tM_e <= iss_e; tM_ti <= iss_ti; tM_q <= iss_q; tM_w <= iss_w;
      tA_valid <= tM_valid; tA_eof <= tM_eof; tA_k <= tM_k; tA_e <= tM_e; tA_ti <= tM_ti; tA_q <= tM_q; tA_prod <= m_prod;
      tB_valid <= tA_valid; tB_eof <= tA_eof; tB_k <= tA_k; tB_e <= tA_e; tB_ti <= tA_ti; tB_q <= tA_q;
      tB_pd <= a_px[47:0]; tB_pdovf <= a_povf;
      fwd1 <= we1 && !clr_active && tA_valid && (tA_e == tB_e);
      fwda <= wea && tA_valid && (tA_ti == tB_ti);
      fwdd <= wed && !clr_active && tA_valid && (tA_ti == tB_ti);
      fwd1_d <= wd1; fwda_d <= an49[47:0]; fwdd_d <= wdd;
      if (wel) wptr <= wptr + 1'b1;

      out_valid <= (b_nt || b_fl) && b_ok;
      out_elem  <= tB_e;
      out_code  <= b_fl ? fc33[31:0] : cn48[31:0];
      out_event <= b_nt ? 1'b1 : dst[0];
      out_eof   <= tB_eof && b_ok;
      if (tB_valid && b_ovf) fail(E_OVF, 1'b0);
    end
  end
  /* verilator lint_on BLKSEQ */
endmodule
`default_nettype wire

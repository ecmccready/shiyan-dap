// TEST ONLY. 4D-SCP v0.1.17 — W-byte-per-cycle temporal-only S4DI v1 decoder with a SHORT ISSUE PATH.
`timescale 1ns/1ps
//
// Same function, ports, stream scope, outputs, error codes AND cycle behaviour as v0.1.13's
// scp4d_tdec_w.v (unchanged, sha-pinned): rank 0, relations off, zero / last / linear hold; integer
// codes bit-exact with the v0.1.10 model; relations or a low-rank base are REJECTED at the header
// with unsupported = 1. Only the logic on the per-cycle issue path changes (v0.1.16's ECP5 critical
// path ran from the element register through the issue chain's 36-bit gap add / compares and the
// token muxes into the front end's token-queue shift):
//   - front end scp4d_fe_r.v: every token is range-checked against D when it enters the queue
//     (flags + narrow fields), and the queue update selects a precomputed candidate by pop count
//     in its last mux level;
//   - issue chain: no 35-bit compare or add; the gap step is a narrow add in parallel with a
//     signed compare against the precomputed (D − 1) − gap; "next element != current" for a gap
//     or first index is the token's value != 0; D − 1 is a register; the token view is selected
//     by a one-hot pop position;
//   - consumed bytes: consumed + (first p token lengths) is formed for every p in parallel and
//     selected by the chain's pop count; "this frame is the last" is a register (fr_last), not a
//     32-bit add + compare after the chain;
//   - banks: the dequantized step (q << G) is formed in stage A and registered into stage B.
// Structure otherwise as scp4d_tdec_w: front end -> issue chain (up to W steps per cycle) -> P = W
// banks of state memory (element e in bank e mod P), each an A (sync read) / B (execute, write,
// forward) pipeline; outputs are P lanes per cycle.
//
// Plain Verilog-2005. No floating point, no division, no hashing, no initial blocks.
`default_nettype none
module scp4d_tdec_r #(
  parameter integer W      = 2,    // input bytes / chain steps / banks per cycle: 1, 2 or 4
  parameter integer ADDR_W = 11,   // max D = 2^ADDR_W elements per frame
  parameter integer G_MAX  = 16
) (
  input  wire                  clk,
  input  wire                  rst,
  input  wire [8*W-1:0]        in_data,
  input  wire [2:0]            in_nbytes,
  input  wire                  in_valid,
  output wire                  in_ready,
  output reg  [W-1:0]          out_valid,
  output reg  [W*ADDR_W-1:0]   out_elem,
  output reg  [W*32-1:0]       out_code,
  output reg  [W-1:0]          out_event,
  output reg                   out_eof,
  output reg                   done,
  output reg                   err,
  output reg                   unsupported,
  output reg  [4:0]            err_code,
  output reg  [31:0]           hdr_T,
  output reg  [ADDR_W:0]       hdr_D,
  output reg  [4:0]            hdr_G,
  output reg  [1:0]            hdr_pred,
  output reg  [31:0]           consumed      // stream bytes retired by the decoder
);
  localparam integer P   = W;
  localparam integer LP  = (W >= 4) ? 2 : (W >= 2) ? 1 : 0;
  localparam integer BA  = ADDR_W - LP;     // bank address width
  localparam integer K   = W;
  localparam [ADDR_W:0] MAXD = 1 << ADDR_W;

  localparam [4:0] E_MAGIC = 5'd1, E_VERSION = 5'd2, E_T0 = 5'd3, E_DSIZE = 5'd4, E_G = 5'd5,
                   E_HVARINT = 5'd6, E_VERDICT = 5'd7, E_RANK = 5'd8, E_REL = 5'd9, E_PRED = 5'd10,
                   E_FW = 5'd11, E_PVARINT = 5'd13, E_QWIDTH = 5'd14, E_QZERO = 5'd15,
                   E_INDEX = 5'd16, E_COUNT = 5'd17, E_OVF = 5'd18;
  localparam [4:0] S_FIX = 5'd0, S_EPS = 5'd1, S_G = 5'd2, S_TIMES = 5'd3, S_MFLAG = 5'd4,
                   S_STEPS = 5'd5, S_VERD = 5'd6, S_RANK = 5'd7, S_REL = 5'd8, S_PRED = 5'd9,
                   S_FW = 5'd10, S_LAYOUT = 5'd11, S_HEAD = 5'd12, S_DENSE = 5'd13,
                   S_SPFIRST = 5'd14, S_SPQ = 5'd15, S_SPGAP = 5'd16, S_SWEEP = 5'd17,
                   S_DRAIN = 5'd18, S_DONE = 5'd19, S_ERR = 5'd20;
  // why the chain ended (debug / measurement only)
  localparam [2:0] W_NONE = 3'd0, W_TOKEN = 3'd1, W_BANK = 3'd2, W_FRAME = 3'd3, W_STEPS = 3'd4, W_FAIL = 3'd5;

  (* fsm_encoding = "none" *) reg [4:0] state;   // not re-encoded by yosys fsm (keeps synthesis tractable at W = 4)
  reg       ovf_q;   // registered lane overflow (sticky)

  // ---------------- front end ----------------
  localparam integer AW = ADDR_W;
  localparam integer O_DMG = 0, O_LO = AW + 2, O_GE = 2*AW + 3, O_NM1 = 2*AW + 4, O_N = 3*AW + 5,
                     O_HBIG = 4*AW + 6, O_HZ = 4*AW + 7, O_DN = 4*AW + 8, O_BIG = 4*AW + 9, O_NZ = 4*AW + 10,
                     O_Q = 4*AW + 11, O_LONG = 4*AW + 43, O_LEN = 4*AW + 44, EW = 4*AW + 47;
  wire        b_avail; wire [7:0] b_data; reg tok_mode;
  wire [4:0]  t_cnt; wire [EW*K-1:0] t_ent;
  reg  [2:0]  t_pop;
  reg  [ADDR_W:0] dm1;     // hdr_D − 1 (registered with hdr_D)
  wire hdr_state = (state <= S_LAYOUT);
  wire b_take = hdr_state && b_avail;
  scp4d_fe_r #(.W(W), .K(K), .ADDR_W(ADDR_W)) fe (
    .clk(clk), .rst(rst), .in_data(in_data), .in_nbytes(in_nbytes), .in_valid(in_valid), .in_ready(in_ready),
    .b_avail(b_avail), .b_data(b_data), .b_pop(b_take),
    .tok_mode(tok_mode), .lim_D(hdr_D), .lim_Dm1(dm1), .t_cnt(t_cnt), .t_ent(t_ent), .t_pop(t_pop));

  // consumed + (lengths of the first p queued tokens), p = 0..K, from registered state only
  reg [31:0] cons_p [0:K];
  reg [31:0] cum;
  integer cp, cq;
  always @(*) begin
    cum = 32'd0;
    for (cp = 0; cp <= K; cp = cp + 1) begin
      cons_p[cp] = consumed + cum;
      if (cp < K) cum = cum + {29'd0, t_ent[EW*cp + O_LEN +: 3]};
    end
  end

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

  reg                clr_active, clr_done;
  reg [BA-1:0]       clr_cnt, clr_last;

  reg [31:0]         fr;
  reg                fr_last;          // fr + 1 == hdr_T (registered)
  reg [ADDR_W:0]     ei, nxt, left, fr_n, dcount;
  reg                nbig;

  wire mode_last = (hdr_pred == 2'd1);
  wire mode_lin  = (hdr_pred == 2'd2);
  wire sweep_mode = !mode_last;

  wire [15:0]        fld   = {b_data, fld_lo};
  wire [ADDR_W+16:0] prod  = dacc * fld;
  wire               pbig  = dbig || (prod > {{16{1'b0}}, MAXD});
  localparam integer PM1I = P - 1;
  localparam [ADDR_W:0] PM1 = PM1I[ADDR_W:0];
  /* verilator lint_off UNUSEDSIGNAL */
  wire [ADDR_W:0]    dplus = prod[ADDR_W:0] + PM1;   // only [ADDR_W-1:LP] is used: ceil(D / P)
  /* verilator lint_on UNUSEDSIGNAL */

  // ---------------- issue chain (combinational) ----------------
  reg [4:0]          c_st;
  reg [ADDR_W:0]     c_ei, c_nxt, c_left, c_frn, c_dc;
  reg                c_nbig, c_stop, c_adv, c_eof, c_fail;
  reg [4:0]          c_code;
  reg [2:0]          c_k, c_steps;
  /* verilator lint_off UNUSEDSIGNAL */
  reg [2:0]          c_why;            // measurement tap (read by the testbench only)
  /* verilator lint_on UNUSEDSIGNAL */
  reg [P-1:0]        c_used;
  reg [P-1:0]        iss_v, iss_ev;
  reg [P*ADDR_W-1:0] iss_e;
  reg [P*32-1:0]     iss_q;
  // per-step temporaries
  reg                tl;
  reg                qbig, qnz;
  reg [31:0]         q32;
  reg                tdn, thz, thbig, tge;
  reg [ADDR_W:0]     tn, tnm1, tlo;
  reg [ADDR_W+1:0]   tdmg;
  reg [ADDR_W:0]     gnext;
  reg [K-1:0]        kh;               // one-hot pop position (bit c_k)
  /* verilator lint_off UNUSEDSIGNAL */
  reg [ADDR_W:0]     el;               // [ADDR_W] (= D) never selects a bank
  /* verilator lint_on UNUSEDSIGNAL */
  reg [P-1:0]        bsel;
  reg [31:0]         lq;
  reg                lev;
  reg                needs_tok, issue, ok_bank;
  integer j, m;

  wire pay_state = (state == S_HEAD) || (state == S_DENSE) || (state == S_SPFIRST) ||
                   (state == S_SPQ) || (state == S_SPGAP) || (state == S_SWEEP);

  /* verilator lint_off WIDTHEXPAND */   // integer loop indices compared with c_k / bank bits
  /* verilator lint_off UNUSEDSIGNAL */  // el[ADDR_W] (D) never selects a bank; c_why is a measurement tap
  always @(*) begin
    c_st = state; c_ei = ei; c_nxt = nxt; c_left = left; c_frn = fr_n; c_dc = dcount; c_nbig = nbig;
    c_stop = !(pay_state && clr_done && !err); c_adv = 1'b0; c_eof = 1'b0; c_fail = 1'b0; c_code = 5'd0;
    c_k = 3'd0; c_why = W_NONE; c_steps = 3'd0; c_used = {P{1'b0}};
    iss_v = {P{1'b0}}; iss_ev = {P{1'b0}}; iss_e = {P*ADDR_W{1'b0}}; iss_q = {P*32{1'b0}};
    tl = 1'b0; qbig = 1'b0; qnz = 1'b0; q32 = 32'd0; gnext = 0;
    tdn = 1'b0; thz = 1'b0; thbig = 1'b0; tge = 1'b0; tn = 0; tnm1 = 0; tlo = 0; tdmg = 0;
    kh = {{(K-1){1'b0}}, 1'b1};
    el = 0; bsel = {P{1'b0}}; lq = 32'd0; lev = 1'b0; needs_tok = 1'b0; issue = 1'b0; ok_bank = 1'b1;
    for (j = 0; j < W; j = j + 1) begin
      if (!c_stop) begin
        // token view for this step
        needs_tok = (c_st != S_SWEEP);
        tl = 1'b0; q32 = 32'd0; qnz = 1'b0; qbig = 1'b0;
        tdn = 1'b0; thz = 1'b0; thbig = 1'b0; tge = 1'b0; tn = 0; tnm1 = 0; tlo = 0; tdmg = 0;
        for (m = 0; m < K; m = m + 1) if (kh[m]) begin   // one-hot token view (pre-decoded in scp4d_fe_r)
          tl = t_ent[EW*m + O_LONG]; q32 = t_ent[EW*m + O_Q +: 32]; qnz = t_ent[EW*m + O_NZ]; qbig = t_ent[EW*m + O_BIG];
          tdn = t_ent[EW*m + O_DN]; thz = t_ent[EW*m + O_HZ]; thbig = t_ent[EW*m + O_HBIG]; tge = t_ent[EW*m + O_GE];
          tn = t_ent[EW*m + O_N +: ADDR_W+1]; tnm1 = t_ent[EW*m + O_NM1 +: ADDR_W+1]; tlo = t_ent[EW*m + O_LO +: ADDR_W+1];
          tdmg = t_ent[EW*m + O_DMG +: ADDR_W+2];
        end
        // element this step would issue (if any)
        case (c_st)
          S_SWEEP: begin el = c_ei; issue = 1'b1; end
          S_SPQ:   begin el = c_nxt; issue = !tl && !qbig && qnz; end
          S_DENSE: begin el = c_ei; issue = !tl && !qbig && (sweep_mode || qnz); end
          default: begin el = c_ei; issue = 1'b0; end
        endcase
        bsel = {P{1'b0}};
        for (m = 0; m < P; m = m + 1) if ((el[LP:0] & (P - 1)) == m) bsel[m] = 1'b1;
        ok_bank = !(issue && ((c_used & bsel) != {P{1'b0}}));
        if (needs_tok && ({2'b00, c_k} >= t_cnt)) begin c_stop = 1'b1; c_why = W_TOKEN; end
        else if (!ok_bank) begin c_stop = 1'b1; c_why = W_BANK; end
        else begin
          c_steps = c_steps + 3'd1;
          if (needs_tok) begin c_k = c_k + 3'd1; kh = kh << 1; end
          lq = 32'd0; lev = 1'b0;
          if (needs_tok && tl) begin c_fail = 1'b1; c_code = E_PVARINT; end
          else case (c_st)
            S_HEAD: begin
              c_frn = tn;                      // head count (value >> 1, narrow)
              c_nbig = thbig;                  // head count > D
              c_dc = 0; c_ei = 0;
              if (tdn) c_st = S_DENSE;
              else if (thz) begin
                if (mode_last) begin c_eof = 1'b1; c_adv = 1'b1; end
                else begin c_nxt = hdr_D; c_st = S_SWEEP; end
              end else if (thbig) begin c_fail = 1'b1; c_code = E_INDEX; end
              else begin c_left = tnm1; c_st = S_SPFIRST; end
            end
            S_SPFIRST: begin
              // value >= D fails; otherwise value fits ADDR_W + 1 bits and c_ei is 0 here (set by S_HEAD),
              // so "first index != c_ei" is "value != 0"
              if (tge) begin c_fail = 1'b1; c_code = E_INDEX; end
              else begin
                c_nxt = tlo;
                c_st = (sweep_mode && qnz) ? S_SWEEP : S_SPQ;
              end
            end
            S_SWEEP: begin
              if (c_ei == dm1) c_eof = 1'b1;
              c_ei = c_ei + 1'b1;
              if (c_ei == c_nxt) begin
                if (c_nxt == hdr_D) c_adv = 1'b1;
                else c_st = S_SPQ;
              end
            end
            S_SPQ: begin
              if (qbig) begin c_fail = 1'b1; c_code = E_QWIDTH; end
              else if (!qnz) begin c_fail = 1'b1; c_code = E_QZERO; end
              else begin
                lq = q32; lev = 1'b1;
                c_eof = mode_last ? (c_left == 0) : (c_left == 0 && c_nxt == dm1);
                c_ei = c_nxt + 1'b1;
                if (c_left != 0) c_st = S_SPGAP;
                else if (c_eof) c_adv = 1'b1;
                else begin c_nxt = hdr_D; c_st = S_SWEEP; end
              end
            end
            S_SPGAP: begin
              // c_ei == c_nxt + 1 here (S_SPGAP only follows S_SPQ), so c_ei + gap >= D is
              // c_nxt >= (D − 1) − gap (precomputed, signed) unless the gap alone is >= D;
              // the narrow sum runs in parallel; "next != c_ei" is "gap != 0"
              gnext = c_ei + tlo;
              if (tge || ($signed({1'b0, c_nxt}) >= $signed(tdmg))) begin c_fail = 1'b1; c_code = E_INDEX; end
              else begin
                c_nxt = gnext; c_left = c_left - 1'b1;
                c_st = (sweep_mode && qnz) ? S_SWEEP : S_SPQ;
              end
            end
            S_DENSE: begin
              if (qbig) begin c_fail = 1'b1; c_code = E_QWIDTH; end
              else begin
                lq = q32; lev = qnz;
                c_eof = (c_ei == dm1);
                c_ei = c_ei + 1'b1;
                c_dc = c_dc + qnz;
                if (c_eof) begin
                  if (!all_dense && (c_nbig || c_dc != c_frn)) begin c_fail = 1'b1; c_code = E_COUNT; end
                  else c_adv = 1'b1;
                end
              end
            end
            default: ;
          endcase
          // lane write (constant indices): the element goes to its bank's lane
          if (issue)
            for (m = 0; m < P; m = m + 1) if (bsel[m]) begin
              c_used[m] = 1'b1; iss_v[m] = 1'b1; iss_e[ADDR_W*m +: ADDR_W] = el[ADDR_W-1:0];
              iss_q[32*m +: 32] = lq; iss_ev[m] = lev;
            end
          if (c_fail) begin c_stop = 1'b1; c_why = W_FAIL; end
          else if (c_adv) begin c_stop = 1'b1; c_why = W_FRAME; end
        end
      end
    end
    if (!c_stop && pay_state && clr_done && !err) c_why = W_STEPS;
  end
  /* verilator lint_on UNUSEDSIGNAL */
  /* verilator lint_on WIDTHEXPAND */

  // ---------------- banks: A (read) / B (execute, write, emit) ----------------
  reg                tA_eof, tA_lin2, tB_eof, tB_lin2;
  wire [P-1:0]       lane_ovf;
  wire [P-1:0]       lane_live;
  wire [P*32-1:0]    lane_code;
  wire [P*ADDR_W-1:0] lane_e;
  wire [P-1:0]       lane_ev;
  wire [P-1:0]       busy_v;
  genvar gb;
  generate for (gb = 0; gb < P; gb = gb + 1) begin : bank
    reg [31:0] mh1 [0:(1<<BA)-1];
    reg [31:0] mh2 [0:(1<<BA)-1];
    reg [31:0] rd1, rd2, fw1d, fw2d;
    reg        fw1, fw2;
    reg              tA_v, tA_ev, tB_v, tB_ev;
    reg [ADDR_W-1:0] tA_e, tB_e;
    reg signed [31:0] tA_q;
    reg signed [47:0] tB_dq;           // q << G, formed in stage A
    wire signed [31:0] h1 = fw1 ? fw1d : rd1;
    wire signed [31:0] h2 = fw2 ? fw2d : rd2;
    wire signed [33:0] h1x = {{2{h1[31]}}, h1};
    wire signed [33:0] h2x = {{2{h2[31]}}, h2};
    wire signed [33:0] hold = mode_lin ? (tB_lin2 ? (h1x <<< 1) - h2x : h1x) : (mode_last ? h1x : 34'sd0);
    wire        hold_ovf = (hold[33:31] != 3'b000) && (hold[33:31] != 3'b111);
    wire signed [47:0] qxA = {{16{tA_q[31]}}, tA_q};
    wire signed [47:0] cn48 = {{14{hold[33]}}, hold} + (tB_ev ? tB_dq : 48'sd0);
    wire        cn_ovf = (cn48[47:31] != 17'd0) && (cn48[47:31] != {17{1'b1}});
    wire [31:0] cnew = cn48[31:0];
    wire        b_ovf = tB_v && (hold_ovf || cn_ovf);
    wire        we1 = clr_active || (tB_v && !b_ovf && ((mode_last && tB_ev) || mode_lin));
    wire        we2 = clr_active || (tB_v && !b_ovf && mode_lin);
    wire [BA-1:0] waddr = clr_active ? clr_cnt : tB_e[ADDR_W-1:LP];
    wire [31:0] wd1 = clr_active ? 32'd0 : cnew;
    wire [31:0] wd2 = clr_active ? 32'd0 : h1;
    assign lane_ovf[gb] = b_ovf; assign lane_live[gb] = tB_v; assign lane_code[32*gb +: 32] = cnew;
    assign lane_e[ADDR_W*gb +: ADDR_W] = tB_e; assign lane_ev[gb] = tB_ev;
    assign busy_v[gb] = tA_v || tB_v;
    always @(posedge clk) begin
      if (we1) mh1[waddr] <= wd1;
      if (we2) mh2[waddr] <= wd2;
      rd1 <= mh1[tA_e[ADDR_W-1:LP]];
      rd2 <= mh2[tA_e[ADDR_W-1:LP]];
    end
    always @(posedge clk) begin
      if (rst) begin
        tA_v <= 1'b0; tA_ev <= 1'b0; tA_e <= 0; tA_q <= 32'sd0; tB_v <= 1'b0; tB_ev <= 1'b0; tB_e <= 0; tB_dq <= 48'sd0;
        fw1 <= 1'b0; fw2 <= 1'b0; fw1d <= 32'd0; fw2d <= 32'd0;
      end else begin
        tA_v <= iss_v[gb]; tA_ev <= iss_ev[gb]; tA_e <= iss_e[ADDR_W*gb +: ADDR_W]; tA_q <= iss_q[32*gb +: 32];
        tB_v <= tA_v; tB_ev <= tA_ev; tB_e <= tA_e; tB_dq <= qxA <<< hdr_G;
        fw1 <= we1 && !clr_active && tA_v && (tA_e == tB_e);
        fw2 <= we2 && !clr_active && tA_v && (tA_e == tB_e);
        fw1d <= wd1; fw2d <= wd2;
      end
    end
  end endgenerate

  // a failing step is never issued; the steps before it are (as scp4d_tdec)
  wire any_ovf = |lane_ovf;
  wire pipe_busy = (|busy_v) || tA_eof || tB_eof;

  task fail(input [4:0] code, input unsup);
    begin
      err <= 1'b1; unsupported <= unsup; err_code <= code; state <= S_ERR;
    end
  endtask

  always @(posedge clk) begin
    if (rst) begin
      state <= S_FIX; bidx <= 5'd0; fld_lo <= 8'd0; dacc <= {{ADDR_W{1'b0}}, 1'b1}; dbig <= 1'b0;
      cnt <= 0; eps_last <= 0; vcount <= 32'd0; hvb <= 3'd0; all_dense <= 1'b0; tok_mode <= 1'b0;
      clr_active <= 1'b0; clr_done <= 1'b0; clr_cnt <= {BA{1'b0}}; clr_last <= {BA{1'b0}};
      fr <= 32'd0; fr_last <= 1'b0; ei <= 0; nxt <= 0; left <= 0; fr_n <= 0; nbig <= 1'b0; dcount <= 0; dm1 <= 0;
      tA_eof <= 1'b0; tA_lin2 <= 1'b0; tB_eof <= 1'b0; tB_lin2 <= 1'b0;
      out_valid <= {W{1'b0}}; out_elem <= 0; out_code <= 0; out_event <= {W{1'b0}}; out_eof <= 1'b0;
      done <= 1'b0; err <= 1'b0; unsupported <= 1'b0; err_code <= 5'd0;
      hdr_T <= 32'd0; hdr_D <= 0; hdr_G <= 5'd0; hdr_pred <= 2'd0; consumed <= 32'd0; ovf_q <= 1'b0;
    end else begin
      if (clr_active) begin
        clr_cnt <= clr_cnt + 1'b1;
        if (clr_cnt == clr_last) begin clr_active <= 1'b0; clr_done <= 1'b1; end
      end
      if (b_take) consumed <= consumed + 32'd1;

      case (state)
        S_FIX: if (b_take) begin
          bidx <= bidx + 5'd1;
          case (bidx)
            5'd0: if (b_data != 8'h53) fail(E_MAGIC, 1'b0);
            5'd1: if (b_data != 8'h34) fail(E_MAGIC, 1'b0);
            5'd2: if (b_data != 8'h44) fail(E_MAGIC, 1'b0);
            5'd3: if (b_data != 8'h49) fail(E_MAGIC, 1'b0);
            5'd4: if (b_data != 8'h01) fail(E_VERSION, 1'b0);
            5'd5: hdr_T[7:0]   <= b_data;
            5'd6: hdr_T[15:8]  <= b_data;
            5'd7: hdr_T[23:16] <= b_data;
            5'd8: hdr_T[31:24] <= b_data;
            5'd9, 5'd11, 5'd13, 5'd15: fld_lo <= b_data;
            5'd10, 5'd12, 5'd14: begin dbig <= pbig; dacc <= prod[ADDR_W:0]; end
            default: begin
              if (hdr_T == 32'd0) fail(E_T0, 1'b1);
              else if (pbig || prod == 0) fail(E_DSIZE, 1'b1);
              else begin
                hdr_D <= prod[ADDR_W:0];
                dm1 <= prod[ADDR_W:0] - 1'b1;
                eps_last <= {fld[ADDR_W:0], 3'b000} - 1'b1;
                cnt <= 0;
                clr_active <= 1'b1; clr_cnt <= {BA{1'b0}};
                clr_last <= dplus[ADDR_W-1:LP] - 1'b1;   // ceil(D / P) − 1 (D ≤ 2^ADDR_W)
                state <= S_EPS;
              end
            end
          endcase
        end
        S_EPS: if (b_take) begin
          cnt <= cnt + 1'b1;
          if (cnt == eps_last) state <= S_G;
        end
        S_G: if (b_take) begin
          if ({24'd0, b_data} > G_MAX) fail(E_G, 1'b1);
          else begin hdr_G <= b_data[4:0]; vcount <= 32'd0; hvb <= 3'd0; state <= S_TIMES; end
        end
        S_TIMES, S_STEPS: if (b_take) begin
          if (b_data[7]) begin
            if (hvb == 3'd7) fail(E_HVARINT, 1'b0);
            else hvb <= hvb + 3'd1;
          end else begin
            if (hvb == 3'd7 && b_data[6:4] != 3'd0) fail(E_HVARINT, 1'b0);
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
        S_MFLAG: if (b_take) state <= (b_data == 8'd1) ? S_STEPS : S_RANK;
        S_VERD: if (b_take) begin
          if (b_data > 8'd2) fail(E_VERDICT, 1'b0);
          else begin
            vcount <= vcount + 32'd1;
            if (vcount + 32'd1 == hdr_T) state <= S_RANK;
          end
        end
        S_RANK: if (b_take) begin
          if (b_data != 8'd0) fail(E_RANK, 1'b1); else state <= S_REL;
        end
        S_REL: if (b_take) begin
          if (b_data == 8'd1) fail(E_REL, 1'b1); else state <= S_PRED;
        end
        S_PRED: if (b_take) begin
          if (b_data > 8'd2) fail(E_PRED, 1'b0);
          else begin hdr_pred <= b_data[1:0]; state <= S_FW; end
        end
        S_FW: if (b_take) begin
          if (b_data != 8'd16) fail(E_FW, 1'b0); else state <= S_LAYOUT;
        end
        S_LAYOUT: if (b_take) begin
          all_dense <= (b_data == 8'd1);
          fr <= 32'd0; fr_last <= (hdr_T == 32'd1); ei <= 0; dcount <= 0; tok_mode <= 1'b1;
          state <= (b_data == 8'd1) ? S_DENSE : S_HEAD;
        end
        S_DRAIN: if (!pipe_busy) begin done <= 1'b1; state <= S_DONE; end
        default: ;
      endcase

      // payload: apply the chain result
      if (pay_state && clr_done && !err) begin
        for (cq = 0; cq <= K; cq = cq + 1) if (c_k == cq) consumed <= cons_p[cq];
        ei <= c_ei; nxt <= c_nxt; left <= c_left; fr_n <= c_frn; nbig <= c_nbig; dcount <= c_dc;
        state <= c_st;
        if (c_fail) fail(c_code, 1'b0);
        else if (c_adv) begin
          fr <= fr + 32'd1;
          fr_last <= (fr + 32'd2 == hdr_T);
          ei <= {(ADDR_W+1){1'b0}};
          dcount <= {(ADDR_W+1){1'b0}};
          if (fr_last) state <= S_DRAIN;
          else state <= all_dense ? S_DENSE : S_HEAD;
        end
      end

      // ---- pipeline: eof / lin2 travel with the cycle's lanes ----
      tA_eof <= c_eof && !c_fail; tA_lin2 <= (fr >= 32'd2);
      tB_eof <= tA_eof; tB_lin2 <= tA_lin2;
      out_valid <= lane_live & ~lane_ovf;
      out_elem  <= lane_e;
      out_code  <= lane_code;
      out_event <= lane_ev;
      out_eof   <= tB_eof && !any_ovf;
      // overflow: the lane's token is suppressed now; err is raised from a register one cycle later
      // (keeps the BRAM -> add -> range check path off the state-register mux)
      ovf_q <= any_ovf || ovf_q;
      if (ovf_q) fail(E_OVF, 1'b0);
    end
  end

  always @(*) t_pop = (pay_state && clr_done && !err) ? c_k : 3'd0;
endmodule
`default_nettype wire

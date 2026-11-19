// TEST ONLY. 4D-SCP v0.1.16 — pipelined temporal-only S4DI v1 ENCODER with a short emitter path
// (rank 0, relations off; zero / last / linear hold), L integer codes in and W stream bytes out per
// cycle. Same function, ports, error codes and cycle behaviour as scp4d_tenc_p.v (v0.1.15,
// unchanged): byte-exact with the v0.1.10 integer model (scripts/scp-v0110-int-scp4d.ts
// encodeIntScp4d) for a fixed configuration.
`timescale 1ns/1ps
//
// What changed against v0.1.15 (clock only; every cycle count is identical):
//   * the sparse gap is computed once, in S2b, and carried in the event record: each record holds
//     the gap of its first event (and its >= 128 flag). The emitter no longer forms positions or
//     subtracts a running position (e_pp is gone): the first event of a record takes the stored
//     gap, a later event of the same record takes (lane - previous lane - 1) < L.
//   * no variable shifts and no constant x variable products on the emitter / packing path:
//     event bytes are placed by explicit offset selectors (one compare per legal offset), the
//     per-lane q varint lengths sit at a 4-bit stride and are picked by explicit lane selectors.
//     (v0.1.15's `3 * lane` length selects and `<< {n, 3'b000}` packing were mapped by yosys onto
//     MULT18X18D blocks and were on the ECP5 critical path.)
//   * the lane of the last emitted event of the head record is a register (e_last).
//   * the record also carries its event count (popcount of the mask, already summed in S2b), and
//     the emitter keeps the head record's remaining count (e_cnt): the FIFO pop and the
//     "second event from the same record" decisions use these counts instead of waiting for the
//     two chained lowest-set-bit picks (which were the next ECP5 critical path, into the FIFO mux).
//
// The rest of the structure is v0.1.15's:
// Pipeline: S0 accept + read issue -> S1r read register (+fwd t-3) -> S1a predict / residual /
// deadband (+fwd t-2) -> S1b q / reconstruction / write -> S2a sizing -> S2b accumulate + record
// write -> S3 frame close; prefetch (4-entry record FIFO) -> emitter -> append stage -> byte queue.
// Frame t+1 is analysed while frame t is emitted; frame t+2 waits until frame t is emitted.
//
// Error codes (err = 1, sticky; the encoder stops): 1 D = 0 or D > 2^ADDR_W, 2 T = 0, 3 G > G_MAX,
// 4 predictor = 3, 5 cfg_tm_len < T + 1, 6 register overflow (pred, residual or reconstruction
// leaves signed 32 bits), 7 input beat lane count != expected, 8 host header beat overruns its
// segment (or 0 / > W bytes).
//
// Plain Verilog-2005. No floating point, no division, no hashing, no initial blocks.
`default_nettype none
module scp4d_tenc_q #(
  parameter integer W      = 4,    // output bytes per cycle: 1, 2 or 4
  parameter integer L      = 8,    // input codes per cycle (lanes / state banks): 1, 2, 4 or 8, L >= W
  parameter integer ADDR_W = 11,   // max D = 2^ADDR_W elements per frame
  parameter integer G_MAX  = 16
) (
  input  wire                 clk,
  input  wire                 rst,
  input  wire                 start,
  input  wire [15:0]          cfg_nx,
  input  wire [15:0]          cfg_ny,
  input  wire [15:0]          cfg_nz,
  input  wire [15:0]          cfg_c,
  input  wire [31:0]          cfg_T,
  input  wire [4:0]           cfg_G,
  input  wire [1:0]           cfg_pred,
  input  wire [31:0]          cfg_tm_len,
  input  wire [8*W-1:0]       hdr_data,
  input  wire [2:0]           hdr_nbytes,
  input  wire                 hdr_valid,
  output wire                 hdr_ready,
  input  wire [32*L-1:0]      in_x,
  input  wire [3:0]           in_n,
  input  wire                 in_valid,
  output wire                 in_ready,
  output wire [8*W-1:0]       out_data,
  output wire [2:0]           out_nbytes,
  output wire                 out_valid,
  input  wire                 out_ready,
  output wire                 busy,
  output reg                  done,
  output reg                  err,
  output reg  [4:0]           err_code,
  output reg  [ADDR_W:0]      cfg_D
);
  localparam integer LL = (L >= 8) ? 3 : (L >= 4) ? 2 : (L >= 2) ? 1 : 0;
  localparam integer GA = ADDR_W - LL;            // group (bank) address width
  localparam integer ES = (W >= 4) ? 2 : 1;       // sparse events retired per cycle
  localparam integer BQ = 32;
  localparam integer MA = (5 * W > 7 * ES) ? 5 * W : 7 * ES;   // max bytes appended per cycle
  localparam integer AW1 = ADDR_W + 1;
  localparam integer QL = 32 * L;                 // record field offsets
  localparam integer RG = QL + 4 * L;             // first-event gap
  localparam integer RB = RG + AW1;               // first-event gap >= 128
  localparam integer RM = RB + 1;                 // event mask
  localparam integer CW = LL + 2;                 // event-count width (holds L)
  localparam integer RC = RM + L;                 // event count (popcount of the mask)
  localparam integer RW = RC + CW + GA;           // record: {group, count, mask, big, gap, qlen[L] (4-bit stride), q[L]}
  localparam [ADDR_W:0] MAXD = 1 << ADDR_W;
  localparam [5:0] W6 = W[5:0], ROOM6 = BQ - MA;
  localparam [2:0] W3 = W[2:0];
  localparam [4:0] E_D = 5'd1, E_T = 5'd2, E_G = 5'd3, E_PRED = 5'd4, E_TM = 5'd5, E_OVF = 5'd6, E_BEAT = 5'd7, E_HDR = 5'd8;
  localparam [2:0] T_IDLE = 3'd0, T_CFG0 = 3'd1, T_CFG1 = 3'd2, T_CFG2 = 3'd3, T_CFG3 = 3'd4, T_RUN = 3'd5, T_DONE = 3'd6, T_ERR = 3'd7;
  localparam [2:0] H_F1 = 3'd0, H_EPS = 3'd1, H_F2 = 3'd2, H_TM = 3'd3, H_F3 = 3'd4;   // then hdr_done

  reg [2:0] st;
  wire run = (st == T_RUN);
  assign busy = (st != T_IDLE) && (st != T_DONE) && (st != T_ERR);

  // ---------------- configuration ----------------
  reg [15:0] c_nx, c_ny, c_nz, c_c;
  reg [31:0] c_T, c_tm;
  reg [4:0]  c_G;
  reg [1:0]  c_pred;
  reg [ADDR_W:0] p_acc;  reg p_big;
  reg [GA:0]  ngroups;
  reg         ng1;
  reg [LL:0]  lastn;
  reg         alld;
  reg [16:0]  kk, halfg;
  wire [15:0] mul_b = (st == T_CFG0) ? c_ny : (st == T_CFG1) ? c_nz : c_c;
  wire [ADDR_W:0] mul_a = (st == T_CFG0) ? c_nx[ADDR_W:0] : p_acc;
  wire        mul_abig = (st == T_CFG0) ? (c_nx > {{(15-ADDR_W){1'b0}}, MAXD}) : p_big;
  wire        mul_bbig = (mul_b > {{(15-ADDR_W){1'b0}}, MAXD});
  wire [2*ADDR_W+1:0] mul_p = mul_a * mul_b[ADDR_W:0];
  wire        mul_zero = (mul_a == 0 && !mul_abig) || (mul_b == 16'd0);
  wire        mul_big  = !mul_zero && (mul_abig || mul_bbig || (mul_p > {{(ADDR_W+1){1'b0}}, MAXD}));
  wire [ADDR_W:0] dm1 = p_acc - 1'b1;
  wire        lin = (c_pred == 2'd2), lst = (c_pred == 2'd1);
  wire [LL:0] lastn_w;
  generate if (LL == 0) begin : ln0
    assign lastn_w = 1'b1;
  end else begin : ln1
    assign lastn_w = {1'b0, dm1[LL-1:0]} + 1'b1;
  end endgenerate

  // ---------------- byte queue ----------------
  reg  [7:0] bq [0:BQ-1];
  reg  [5:0] bcnt;
  reg        emit_done;
  reg  [4:0] app_n;                // this cycle's append (registered into the stage below)
  reg  [8*MA-1:0] app_b;
  reg  [4:0] stg_n;                // staged append: written into the queue on the next edge
  reg  [8*MA-1:0] stg_b;
  wire [5:0] bsum = bcnt + {1'b0, stg_n};   // queue + stage occupancy
  wire       room = (bsum <= ROOM6);        // any single-cycle append fits
  wire       flush = emit_done && (stg_n == 5'd0);
  assign out_valid  = run && ((bcnt >= W6) || (flush && bcnt != 6'd0));
  assign out_nbytes = (bcnt >= W6) ? W3 : bcnt[2:0];
  genvar gw;
  generate for (gw = 0; gw < W; gw = gw + 1) begin : ob
    assign out_data[8*gw +: 8] = bq[gw];
  end endgenerate
  wire [5:0] pop  = (out_valid && out_ready) ? {3'd0, out_nbytes} : 6'd0;
  wire [5:0] keep = bcnt - pop;

  // ---------------- varint helpers ----------------
  /* verilator lint_off UNUSEDSIGNAL */
  function [2:0] vlen;            // LEB128 length of a 35-bit unsigned value (<= 5 bytes for < 2^35)
    input [34:0] v;
    begin
      vlen = (v[34:28] != 0) ? 3'd5 : (v[27:21] != 0) ? 3'd4 : (v[20:14] != 0) ? 3'd3 : (v[13:7] != 0) ? 3'd2 : 3'd1;
    end
  endfunction
  /* verilator lint_on UNUSEDSIGNAL */
  function [39:0] vbn;            // LEB128 bytes (byte 0 first) of v with its (known) length n
    input [34:0] v; input [2:0] n;
    begin
      vbn = {1'b0, v[34:28], (n > 3'd4), v[27:21], (n > 3'd3), v[20:14], (n > 3'd2), v[13:7], (n > 3'd1), v[6:0]};
    end
  endfunction
  function [34:0] zz;             // zigzag of a signed 32-bit q
    input [31:0] q;
    begin
      zz = q[31] ? {2'b0, ~q, 1'b1} : {2'b0, q, 1'b0};
    end
  endfunction

  // ---------------- header engine ----------------
  reg [2:0]  hseg;
  reg [31:0] hcnt;
  reg        hdr_done;
  wire [31:0] seg_len = (hseg == H_F1) ? 32'd17 : (hseg == H_EPS) ? {13'd0, c_c, 3'd0} : (hseg == H_F2) ? 32'd1 : (hseg == H_TM) ? c_tm : 32'd5;
  wire [31:0] seg_rem = seg_len - hcnt;
  wire        host_seg = (hseg == H_EPS) || (hseg == H_TM);
  assign hdr_ready = run && !err && host_seg && room;
  wire [167:0] f1v = {32'd0, c_c, c_nz, c_ny, c_nx, c_T, 8'd1, 8'h49, 8'h44, 8'h34, 8'h53};   // byte 0 = 'S'
  wire [63:0]  f3v = {24'd0, 7'd0, alld, 8'd16, 6'd0, c_pred, 8'd0, 8'd0};
  function [7:0] fbyte;
    input [2:0] seg; input [4:0] idx; input [167:0] a; input [63:0] c; input [4:0] g;
    begin
      if (seg == H_F1) fbyte = a[8*idx +: 8];
      else if (seg == H_F2) fbyte = {3'd0, g};
      else fbyte = c[8*idx[2:0] +: 8];
    end
  endfunction
  /* verilator lint_off WIDTHTRUNC */
  wire [2:0] fix_n = (seg_rem < W) ? seg_rem[2:0] : W3;
  /* verilator lint_on WIDTHTRUNC */

  // ---------------- S0: accept + state read issue ----------------
  reg [31:0] a_t;
  reg [GA:0] a_g;
  reg [1:0]  hbusy;
  reg        r_v;                  // S1r valid (= a beat was taken last cycle)
  wire a_lastg = (a_g == ngroups - 1'b1);
  wire acc_ok  = run && !err && (a_t < c_T) && ((a_g != 0) || !hbusy[a_t[0]]) && !(ng1 && r_v);
  assign in_ready = acc_ok;
  wire take = in_valid && acc_ok;
  /* verilator lint_off WIDTHEXPAND */
  /* verilator lint_off WIDTHTRUNC */
  wire [3:0] exp_n = a_lastg ? lastn : L[3:0];
  /* verilator lint_on WIDTHTRUNC */
  /* verilator lint_on WIDTHEXPAND */
  wire [GA-1:0] raddr = a_g[GA-1:0];

  // S1r registers (beat + raw state read)
  reg            r_t0, r_t2, r_first, r_lastg, r_half;
  reg [GA:0]     r_g;
  reg [3:0]      r_n;
  reg [32*L-1:0] r_x;
  // S1a registers
  reg            a1_v, a1_t0, a1_t2, a1_first, a1_lastg, a1_half;
  reg [GA:0]     a1_g;
  reg [3:0]      a1_n;
  reg [36*L-1:0] a1_x, a1_xh, a1_xk1, a1_xk2;   // x, x + half, x - k - 1, x + k (36-bit signed)
  reg [32*L-1:0] a1_h1, a1_h2;
  // S1b registers
  reg            b1_v, b1_first, b1_lastg, b1_half, b1_t0;
  reg [GA:0]     b1_g;
  reg [L-1:0]    b1_lv, b1_ev, b1_ovfa;
  reg [36*L-1:0] b1_pr, b1_rh;
  reg [32*L-1:0] b1_h1;
  // forwarding register: the state write of the last edge
  reg            fw_v;
  reg [GA:0]     fw_g;
  reg [L-1:0]    fw_we1, fw_we2;
  reg [32*L-1:0] fw_h1, fw_h2;
  // memories (L banks; element e in bank e mod L at address e >> LL)
  wire [32*L-1:0] h1r, h2r;
  reg  [L-1:0]    we1, we2;
  reg  [32*L-1:0] wd1, wd2;
  genvar gb;
  generate for (gb = 0; gb < L; gb = gb + 1) begin : bank
    reg [31:0] m1 [0:(1<<GA)-1];
    reg [31:0] m2 [0:(1<<GA)-1];
    reg [31:0] q1, q2;
    always @(posedge clk) begin
      if (we1[gb]) m1[b1_g[GA-1:0]] <= wd1[32*gb +: 32];
      if (take) q1 <= m1[raddr];
    end
    always @(posedge clk) begin
      if (we2[gb]) m2[b1_g[GA-1:0]] <= wd2[32*gb +: 32];
      if (take) q2 <= m2[raddr];
    end
    assign h1r[32*gb +: 32] = q1;
    assign h2r[32*gb +: 32] = q2;
  end endgenerate

  // ---------------- S1r -> S1a: forward the write of 3 beats back; precompute from x ----------------
  reg [36*L-1:0] n_x, n_xh, n_xk1, n_xk2;
  reg [32*L-1:0] n_h1, n_h2;
  reg signed [35:0] t_x;
  integer i0;
  always @(*) begin
    n_x = 0; n_xh = 0; n_xk1 = 0; n_xk2 = 0; n_h1 = 0; n_h2 = 0; t_x = 0;
    for (i0 = 0; i0 < L; i0 = i0 + 1) begin
      t_x = $signed({{4{r_x[32*i0+31]}}, r_x[32*i0 +: 32]});
      n_x[36*i0 +: 36]   = t_x;
      n_xh[36*i0 +: 36]  = t_x + $signed({19'd0, halfg});
      n_xk1[36*i0 +: 36] = t_x - $signed({19'd0, kk}) - 36'sd1;
      n_xk2[36*i0 +: 36] = t_x + $signed({19'd0, kk});
      n_h1[32*i0 +: 32]  = (fw_v && fw_g == r_g && fw_we1[i0]) ? fw_h1[32*i0 +: 32] : h1r[32*i0 +: 32];
      n_h2[32*i0 +: 32]  = (fw_v && fw_g == r_g && fw_we2[i0]) ? fw_h2[32*i0 +: 32] : h2r[32*i0 +: 32];
    end
  end

  // ---------------- S1a: forward the write of 2 beats back; predict; residual; deadband ----------------
  reg [L-1:0]    a_lv, a_ev, a_ovf;
  reg [36*L-1:0] a_pr, a_rh;
  reg [32*L-1:0] a_h1;
  reg signed [33:0] h1s, h2s;
  reg signed [35:0] pr, rr, rh, ehi, elo;
  reg [31:0] h1w, h2w;
  integer i1;
  always @(*) begin
    a_lv = 0; a_ev = 0; a_ovf = 0; a_pr = 0; a_rh = 0; a_h1 = 0;
    h1s = 0; h2s = 0; pr = 0; rr = 0; rh = 0; ehi = 0; elo = 0; h1w = 0; h2w = 0;
    for (i1 = 0; i1 < L; i1 = i1 + 1) begin
      a_lv[i1] = a1_v && (i1 < a1_n);
      h1w = (fw_v && fw_g == a1_g && fw_we1[i1]) ? fw_h1[32*i1 +: 32] : a1_h1[32*i1 +: 32];
      h2w = (fw_v && fw_g == a1_g && fw_we2[i1]) ? fw_h2[32*i1 +: 32] : a1_h2[32*i1 +: 32];
      h1s = a1_t0 ? 34'sd0 : $signed({{2{h1w[31]}}, h1w});
      h2s = a1_t0 ? 34'sd0 : $signed({{2{h2w[31]}}, h2w});
      if (lst) pr = {{2{h1s[33]}}, h1s};
      else if (lin) pr = a1_t2 ? ($signed({{2{h1s[33]}}, h1s[32:0], 1'b0}) - $signed({{2{h2s[33]}}, h2s})) : {{2{h1s[33]}}, h1s};
      else pr = 36'sd0;
      rr  = $signed(a1_x[36*i1 +: 36]) - pr;
      rh  = $signed(a1_xh[36*i1 +: 36]) - pr;
      ehi = $signed(a1_xk1[36*i1 +: 36]) - pr;     // >= 0  <=>  r > k
      elo = $signed(a1_xk2[36*i1 +: 36]) - pr;     // <  0  <=>  r < -k
      a_ev[i1]  = a_lv[i1] && (!ehi[35] || elo[35]);
      a_ovf[i1] = a_lv[i1] && ((pr[35:31] != {5{pr[31]}}) || (rr[35:31] != {5{rr[31]}}));
      a_pr[36*i1 +: 36] = pr;
      a_rh[36*i1 +: 36] = rh;
      a_h1[32*i1 +: 32] = h1s[31:0];
    end
  end

  // ---------------- S1b: q, reconstruction, overflow, state write ----------------
  reg [L-1:0]    s1_ovf;
  reg [32*L-1:0] s1_q;
  reg signed [35:0] bpr, brh, qq, cn;
  integer i2;
  always @(*) begin
    we1 = 0; we2 = 0; wd1 = 0; wd2 = 0; s1_ovf = 0; s1_q = 0; bpr = 0; brh = 0; qq = 0; cn = 0;
    for (i2 = 0; i2 < L; i2 = i2 + 1) begin
      bpr = $signed(b1_pr[36*i2 +: 36]);
      brh = $signed(b1_rh[36*i2 +: 36]);
      qq  = brh >>> c_G;
      cn  = bpr + (b1_ev[i2] ? (brh & ~$signed({19'd0, kk})) : 36'sd0);
      s1_q[32*i2 +: 32] = qq[31:0];
      s1_ovf[i2] = b1_ovfa[i2] || (b1_lv[i2] && (cn[35:31] != {5{cn[31]}}));
      we1[i2] = b1_lv[i2] && (lin || (lst && (b1_ev[i2] || b1_t0)));
      we2[i2] = b1_lv[i2] && lin;
      wd1[32*i2 +: 32] = cn[31:0];
      wd2[32*i2 +: 32] = b1_h1[32*i2 +: 32];
    end
  end
  wire any_ovf = |s1_ovf;
  reg  ovf_r;

  // ---------------- S2a: per-beat sizing (no recurrence) ----------------
  reg            s2_v, s2_first, s2_lastg, s2_half;
  reg [GA:0]     s2_g;
  reg [L-1:0]    s2_ev;
  reg [32*L-1:0] s2_q;
  reg [32*L-1:0] qst;
  reg [4*L-1:0]  qln;
  reg [2:0]      sl;
  reg [5:0]      slsum;              // <= 8 * 5
  reg [LL+1:0]   cnt;
  reg [LL:0]     fc, lc;
  reg            fnd;
  integer c;
  always @(*) begin
    qst = 0; qln = 0; sl = 0; slsum = 0; cnt = 0; fc = 0; lc = 0; fnd = 1'b0;
    for (c = 0; c < L; c = c + 1) begin
      qln[4*c +: 4] = 4'd1;
      if (s2_ev[c]) begin
        sl    = vlen(zz(s2_q[32*c +: 32]));
        qln[4*c +: 4] = {1'b0, sl};
        slsum = slsum + {3'd0, sl};
        cnt   = cnt + 1'b1;
        if (!fnd) fc = c[LL:0];
        fnd   = 1'b1;
        lc    = c[LL:0];
        qst[32*c +: 32] = s2_q[32*c +: 32];
      end
    end
  end

  // ---------------- S2b: frame accumulators + record write ----------------
  reg            p2_v, p2_first, p2_lastg, p2_half, p2_fnd;
  reg [GA:0]     p2_g;
  reg [L-1:0]    p2_ev;
  reg [32*L-1:0] p2_q;
  reg [4*L-1:0]  p2_ql;
  reg [5:0]      p2_sl;
  reg [LL+1:0]   p2_cnt;           // events in the group (== popcount(p2_ev)); also stored in the record
  reg [LL:0]     p2_fc, p2_lc;
  reg [ADDR_W:0] n_acc, pp_acc;
  reg [15:0]     sp_acc, dn_acc;
  reg [GA:0]     nr_acc;
  reg [ADDR_W:0] n2, pp2, pin, gbase, gap;
  reg [15:0]     sp2, dn2;
  reg            big;
  // Only the first event of a group can have a gap >= 128 (later gaps are < L).
  always @(*) begin
    pin = p2_first ? 0 : pp_acc;
    /* verilator lint_off WIDTHEXPAND */
    gbase = p2_g;
    /* verilator lint_on WIDTHEXPAND */
    gbase = gbase << LL;
    /* verilator lint_off WIDTHEXPAND */
    gap = (gbase | p2_fc) - pin;
    big = p2_fnd && (gap >= 128);
    sp2 = (p2_first ? 16'd0 : sp_acc) + p2_cnt + p2_sl + big;
    dn2 = (p2_first ? 16'd0 : dn_acc) + p2_sl - p2_cnt;
    n2  = (p2_first ? 0 : n_acc) + p2_cnt;
    pp2 = p2_fnd ? ((gbase | p2_lc) + 1'b1) : pin;
    /* verilator lint_on WIDTHEXPAND */
  end
  wire [GA:0] nr2 = p2_first ? 0 : nr_acc;
  wire        rec_we = p2_v && p2_fnd;
  reg  [RW-1:0] recm [0:(2<<GA)-1];
  reg  [RW-1:0] rrec;
  wire          r_en;
  wire [GA:0]   r_addr;
  always @(posedge clk) begin
    if (rec_we) recm[{p2_half, nr2[GA-1:0]}] <= {p2_g[GA-1:0], p2_cnt, p2_ev, big, gap, p2_ql, p2_q};
    if (r_en) rrec <= recm[r_addr];
  end

  // S3 close
  reg            cl_v, cl_half;
  reg [ADDR_W:0] cl_n;
  reg [15:0]     cl_sp, cl_dn;
  reg [GA:0]     cl_nr;
  reg [1:0]      dvalid;
  reg [ADDR_W:0] dsc_n [0:1];
  reg            dsc_dense [0:1];
  reg [GA:0]     dsc_nr [0:1];

  // ---------------- emitter ----------------
  reg            es_body;
  reg [31:0]     e_f;
  reg [ADDR_W:0] e_left;
  reg [LL:0]     e_last;           // lane of the last emitted event of the head record
  reg            e_dense, e_fresh;
  reg [GA:0]     e_rleft, e_g;
  reg [LL:0]     e_lane;
  reg [L-1:0]    e_rem;
  reg [CW-1:0]   e_cnt;            // events left in the head record when !e_fresh (== popcount(e_rem))
  wire           eh = e_f[0];
  // record prefetch: sequential reads of the emitted frame's records into a 4-entry register FIFO
  // (issue iff fcnt + rv <= 3 on registered counts; up to 2 records leave per cycle)
  reg  [31:0]    pf_f;
  reg  [GA:0]    pf_i, pf_n;
  reg            pf_on, rv;
  reg  [RW-1:0]  fq0, fq1, fq2, fq3;
  reg  [2:0]     fcnt;
  wire           pf_ok = (pf_f == e_f) || (pf_f == e_f + 1);
  assign r_en   = run && !err && pf_on && (pf_i != pf_n) && ({1'b0, fcnt} + {3'd0, rv} <= 4'd3);
  assign r_addr = {pf_f[0], pf_i[GA-1:0]};
  wire           hd_v = (fcnt != 3'd0);
  wire [GA-1:0]  rg0 = fq0[RW-1 -: GA];
  wire [L-1:0]   rm0 = fq0[RM +: L],  rm1 = fq1[RM +: L];
  wire [AW1-1:0] rgap0 = fq0[RG +: AW1], rgap1 = fq1[RG +: AW1];
  wire           rbig0 = fq0[RB], rbig1 = fq1[RB];
  wire [CW-1:0]  rc0 = fq0[RC +: CW], rc1 = fq1[RC +: CW];
  // START
  wire [ADDR_W+1:0] hv = {dsc_n[eh], dsc_dense[eh]};
  wire [2:0]     hlen = alld ? 3'd0 : (hv >= 128) ? 3'd2 : 3'd1;
  wire           st_go = run && !err && hdr_done && !emit_done && !es_body && dvalid[eh] && room;
  // sparse body: event 1 (lowest remaining lane of the head record), event 2 (ES = 2: next lane of
  // the same record, else the first lane of the next record). Lane picks are explicit selectors.
  wire [L-1:0]   sm = e_fresh ? rm0 : e_rem;
  reg  [LL:0]    sb1, sb2;
  reg  [L-1:0]   srcm, m2, m3;
  reg  [31:0]    q1, q2;
  reg  [2:0]     ql1, ql2;
  // record-advance decisions come from the carried event counts, not from the lane picks
  wire [CW-1:0]  ecnt = e_fresh ? rc0 : e_cnt;
  wire           same2 = (ecnt > 1);          // == (m2 != 0)
  wire           m3z   = same2 ? (ecnt == 2) : (rc1 == 1);   // == (m3 == 0)
  integer k;
  always @(*) begin
    sb1 = 0; sb2 = 0; q1 = 0; q2 = 0; ql1 = 0; ql2 = 0;
    for (k = L - 1; k >= 0; k = k - 1) if (sm[k]) sb1 = k[LL:0];
    m2 = sm;
    for (k = 0; k < L; k = k + 1) if (sb1 == k) begin m2[k] = 1'b0; q1 = fq0[32*k +: 32]; ql1 = fq0[QL + 4*k +: 3]; end
    srcm = same2 ? m2 : rm1;
    for (k = L - 1; k >= 0; k = k - 1) if (srcm[k]) sb2 = k[LL:0];
    m3 = srcm;
    for (k = 0; k < L; k = k + 1) if (sb2 == k) begin
      m3[k] = 1'b0;
      q2  = same2 ? fq0[32*k +: 32] : fq1[32*k +: 32];
      ql2 = same2 ? fq0[QL + 4*k +: 3] : fq1[QL + 4*k +: 3];
    end
  end
  /* verilator lint_off WIDTHEXPAND */
  /* verilator lint_off WIDTHTRUNC */
  wire [LL:0]     wg1  = sb1 - e_last - 1'b1;            // gap inside the head record (< L)
  wire [LL:0]     wg2  = sb2 - sb1 - 1'b1;
  wire [AW1-1:0]  gap1 = e_fresh ? rgap0 : wg1;
  wire [AW1-1:0]  gap2 = same2 ? wg2 : rgap1;
  /* verilator lint_on WIDTHTRUNC */
  /* verilator lint_on WIDTHEXPAND */
  wire            big1 = e_fresh && rbig0, big2 = !same2 && rbig1;
  wire [3:0]      n1   = (big1 ? 4'd2 : 4'd1) + {1'b0, ql1};
  wire [3:0]      n2e  = (big2 ? 4'd2 : 4'd1) + {1'b0, ql2};
  // event bytes: gap varint (1 or 2 bytes) followed by the q varint (gaps are < 2^14)
  function [55:0] evb;
    input [AW1-1:0] g; input bg; input [31:0] q; input [2:0] ql;
    reg [39:0] qb; reg [34:0] gz;
    begin
      gz = 0; gz[AW1-1:0] = g;
      qb = vbn(zz(q), ql);
      evb = bg ? {qb, 1'b0, gz[13:7], 1'b1, gz[6:0]} : {8'd0, qb, 1'b0, gz[6:0]};
    end
  endfunction
  wire [55:0]     ev1b = evb(gap1, big1, q1, ql1);
  wire [55:0]     ev2b = evb(gap2, big2, q2, ql2);
  wire            take2 = (ES == 2) && (e_left >= 2) && (same2 || fcnt >= 3'd2);
  // dense body
  wire [LL:0]     d_ln  = (e_g == ngroups - 1'b1) ? lastn : L[LL:0];
  wire            d_need  = (e_rleft != 0);
  wire            d_match = d_need && (rg0 == e_g[GA-1:0]);
  reg  [4:0]      d_n;
  reg  [8*MA-1:0] d_b;
  reg  [31:0]     dq;
  reg  [2:0]      dl;
  reg  [39:0]     dlb;
  integer w, kd, o;
  /* verilator lint_off WIDTHEXPAND */
  always @(*) begin
    d_n = 0; d_b = 0; dq = 0; dl = 0; dlb = 0;
    for (w = 0; w < W; w = w + 1) begin
      dq = 0; dl = 3'd1;
      for (kd = 0; kd < L; kd = kd + 1) if (d_match && e_lane + w == kd) begin dq = fq0[32*kd +: 32]; dl = fq0[QL + 4*kd +: 3]; end
      if (e_lane + w < d_ln) begin
        dlb = vbn(zz(dq), dl);
        for (o = 0; o <= 5 * w; o = o + 1) if (d_n == o) d_b = d_b | ({{(8*MA-40){1'b0}}, dlb} << (8 * o));
        d_n = d_n + {2'b0, dl};
      end
    end
  end
  /* verilator lint_on WIDTHEXPAND */
  wire            body_sp = run && !err && es_body && !e_dense && hd_v && room;
  wire            body_dn = run && !err && es_body && e_dense && (hd_v || !d_need) && room;
  wire            d_gdone = ({1'b0, e_lane} + W[LL+1:0] >= {1'b0, d_ln});
  // records leaving the FIFO this cycle
  reg  [1:0]      f_pop;
  always @(*) begin
    f_pop = 2'd0;
    if (body_sp) begin
      if (!take2) f_pop = same2 ? 2'd0 : 2'd1;
      else if (same2) f_pop = m3z ? 2'd1 : 2'd0;
      else f_pop = m3z ? 2'd2 : 2'd1;
    end else if (body_dn && d_gdone && d_match) f_pop = 2'd1;
  end
  wire            fin_sp = take2 ? (e_left == 2) : (e_left == 1);
  wire            fin = (st_go && !dsc_dense[eh] && dsc_n[eh] == 0) || (body_sp && fin_sp) || (body_dn && d_gdone && e_g == ngroups - 1'b1);

  // append source
  integer m, o2;
  always @(*) begin
    app_n = 0; app_b = 0;
    if (run && !err && !hdr_done) begin
      if (!host_seg && room) begin
        app_n = {2'b0, fix_n};
        for (m = 0; m < W; m = m + 1) app_b[8*m +: 8] = fbyte(hseg, hcnt[4:0] + m[4:0], f1v, f3v, c_G);
      end else if (host_seg && hdr_valid && room) begin
        app_n = {2'b0, hdr_nbytes};
        app_b[8*W-1:0] = hdr_data;
      end
    end else if (st_go) begin
      app_n = {2'b0, hlen};
      app_b[39:0] = vbn({{(34-ADDR_W-1){1'b0}}, hv}, hlen);
    end else if (body_sp) begin
      app_n = {1'b0, n1} + (take2 ? {1'b0, n2e} : 5'd0);
      app_b[55:0] = ev1b;
      if (take2) for (o2 = 2; o2 <= 7; o2 = o2 + 1) if (n1 == o2) app_b = app_b | ({{(8*MA-56){1'b0}}, ev2b} << (8 * o2));
    end else if (body_dn) begin
      app_n = d_n; app_b = d_b;
    end
  end

  // ---------------- sequential ----------------
  integer j;
  /* verilator lint_off WIDTHEXPAND */
  /* verilator lint_off WIDTHTRUNC */
  always @(posedge clk) begin
    if (rst) begin
      st <= T_IDLE; done <= 1'b0; err <= 1'b0; err_code <= 5'd0; cfg_D <= 0;
      c_nx <= 0; c_ny <= 0; c_nz <= 0; c_c <= 0; c_T <= 0; c_tm <= 0; c_G <= 0; c_pred <= 0;
      p_acc <= 0; p_big <= 1'b0; ngroups <= 0; ng1 <= 1'b0; lastn <= 0; alld <= 1'b0; kk <= 0; halfg <= 0;
      bcnt <= 0; stg_n <= 0; stg_b <= 0; emit_done <= 1'b0; hseg <= H_F1; hcnt <= 0; hdr_done <= 1'b0;
      for (j = 0; j < BQ; j = j + 1) bq[j] <= 8'd0;
      a_t <= 0; a_g <= 0; hbusy <= 2'b00;
      r_v <= 1'b0; r_t0 <= 1'b0; r_t2 <= 1'b0; r_first <= 1'b0; r_lastg <= 1'b0; r_half <= 1'b0; r_g <= 0; r_n <= 0; r_x <= 0;
      a1_v <= 1'b0; a1_t0 <= 1'b0; a1_t2 <= 1'b0; a1_first <= 1'b0; a1_lastg <= 1'b0; a1_half <= 1'b0; a1_g <= 0; a1_n <= 0;
      a1_x <= 0; a1_xh <= 0; a1_xk1 <= 0; a1_xk2 <= 0; a1_h1 <= 0; a1_h2 <= 0;
      b1_v <= 1'b0; b1_first <= 1'b0; b1_lastg <= 1'b0; b1_half <= 1'b0; b1_t0 <= 1'b0; b1_g <= 0; b1_lv <= 0; b1_ev <= 0; b1_ovfa <= 0;
      b1_pr <= 0; b1_rh <= 0; b1_h1 <= 0;
      fw_v <= 1'b0; fw_g <= 0; fw_we1 <= 0; fw_we2 <= 0; fw_h1 <= 0; fw_h2 <= 0;
      s2_v <= 1'b0; s2_first <= 1'b0; s2_lastg <= 1'b0; s2_half <= 1'b0; s2_g <= 0; s2_ev <= 0; s2_q <= 0;
      p2_v <= 1'b0; p2_first <= 1'b0; p2_lastg <= 1'b0; p2_half <= 1'b0; p2_fnd <= 1'b0; p2_g <= 0; p2_ev <= 0; p2_q <= 0; p2_ql <= 0;
      p2_sl <= 0; p2_cnt <= 0; p2_fc <= 0; p2_lc <= 0;
      ovf_r <= 1'b0;
      n_acc <= 0; pp_acc <= 0; sp_acc <= 0; dn_acc <= 0; nr_acc <= 0;
      cl_v <= 1'b0; cl_half <= 1'b0; cl_n <= 0; cl_sp <= 0; cl_dn <= 0; cl_nr <= 0; dvalid <= 2'b00;
      dsc_n[0] <= 0; dsc_n[1] <= 0; dsc_dense[0] <= 1'b0; dsc_dense[1] <= 1'b0; dsc_nr[0] <= 0; dsc_nr[1] <= 0;
      es_body <= 1'b0; e_f <= 0; e_left <= 0; e_last <= 0; e_dense <= 1'b0; e_fresh <= 1'b0; e_rleft <= 0; e_g <= 0;
      pf_f <= 0; pf_i <= 0; pf_n <= 0; pf_on <= 1'b0; rv <= 1'b0; fcnt <= 3'd0; fq0 <= 0; fq1 <= 0; fq2 <= 0; fq3 <= 0; e_lane <= 0; e_rem <= 0; e_cnt <= 0;
    end else begin
      case (st)
        T_IDLE: if (start) begin
          c_nx <= cfg_nx; c_ny <= cfg_ny; c_nz <= cfg_nz; c_c <= cfg_c; c_T <= cfg_T; c_tm <= cfg_tm_len; c_G <= cfg_G; c_pred <= cfg_pred;
          st <= T_CFG0;
        end
        T_CFG0, T_CFG1, T_CFG2: begin
          p_acc <= mul_big ? MAXD : mul_p[ADDR_W:0]; p_big <= mul_big;
          st <= st + 3'd1;
        end
        T_CFG3: begin
          cfg_D <= p_acc;
          if (p_big || p_acc == 0) begin err <= 1'b1; err_code <= E_D; st <= T_ERR; end
          else if (c_T == 0) begin err <= 1'b1; err_code <= E_T; st <= T_ERR; end
          else if (c_G > G_MAX) begin err <= 1'b1; err_code <= E_G; st <= T_ERR; end
          else if (c_pred == 2'd3) begin err <= 1'b1; err_code <= E_PRED; st <= T_ERR; end
          else if ({1'b0, c_tm} < {1'b0, c_T} + 33'd1) begin err <= 1'b1; err_code <= E_TM; st <= T_ERR; end
          else st <= T_RUN;
          ngroups <= dm1[ADDR_W:LL] + 1'b1;
          ng1 <= (dm1[ADDR_W:LL] == 0);
          lastn <= lastn_w;
          alld <= (p_acc <= 8);
          kk <= (17'd1 << c_G) - 17'd1;
          halfg <= (c_G == 0) ? 17'd0 : (17'd1 << (c_G - 1'b1));
        end
        T_RUN: begin
          // ---- byte queue ----
          for (j = 0; j < BQ; j = j + 1) begin
            if (j < keep) bq[j] <= bq[j + pop];
            else if ((j - keep) < stg_n) bq[j] <= stg_b[8*(j - keep) +: 8];
          end
          bcnt <= keep + {1'b0, stg_n};
          stg_n <= app_n; stg_b <= app_b;
          // ---- header ----
          if (!hdr_done) begin
            if (!host_seg && room) begin
              if (hcnt + fix_n == seg_len) begin hcnt <= 0; hseg <= hseg + 3'd1; if (hseg == H_F3) hdr_done <= 1'b1; end
              else hcnt <= hcnt + fix_n;
            end else if (host_seg && hdr_valid && room) begin
              if (hdr_nbytes == 0 || hdr_nbytes > W || {29'd0, hdr_nbytes} > seg_rem) begin err <= 1'b1; err_code <= E_HDR; st <= T_ERR; end
              else if (hcnt + hdr_nbytes == seg_len) begin hcnt <= 0; hseg <= hseg + 3'd1; end
              else hcnt <= hcnt + hdr_nbytes;
            end
          end
          // ---- S0 ----
          r_v <= take;
          if (take) begin
            if (in_n != exp_n) begin err <= 1'b1; err_code <= E_BEAT; st <= T_ERR; end
            r_x <= in_x; r_g <= a_g; r_n <= exp_n; r_t0 <= (a_t == 0); r_t2 <= (a_t >= 2); r_first <= (a_g == 0); r_lastg <= a_lastg; r_half <= a_t[0];
            if (a_lastg) begin a_g <= 0; a_t <= a_t + 1; end else a_g <= a_g + 1'b1;
          end
          // ---- S1r -> S1a ----
          a1_v <= r_v; a1_t0 <= r_t0; a1_t2 <= r_t2; a1_first <= r_first; a1_lastg <= r_lastg; a1_half <= r_half; a1_g <= r_g; a1_n <= r_n;
          a1_x <= n_x; a1_xh <= n_xh; a1_xk1 <= n_xk1; a1_xk2 <= n_xk2; a1_h1 <= n_h1; a1_h2 <= n_h2;
          // ---- S1a -> S1b ----
          b1_v <= a1_v; b1_first <= a1_first; b1_lastg <= a1_lastg; b1_half <= a1_half; b1_t0 <= a1_t0; b1_g <= a1_g;
          b1_lv <= a_lv; b1_ev <= a_ev; b1_ovfa <= a_ovf; b1_pr <= a_pr; b1_rh <= a_rh; b1_h1 <= a_h1;
          // ---- S1b ----
          fw_v <= b1_v; fw_g <= b1_g; fw_we1 <= we1; fw_we2 <= we2; fw_h1 <= wd1; fw_h2 <= wd2;
          // overflow is registered (ovf_r) and raised one cycle later: the overflowing frame cannot
          // reach S3 / the emitter before the core stops (close is three stages behind S1b).
          ovf_r <= b1_v && any_ovf;
          if (ovf_r) begin err <= 1'b1; err_code <= E_OVF; st <= T_ERR; end
          s2_v <= b1_v; s2_first <= b1_first; s2_lastg <= b1_lastg; s2_half <= b1_half; s2_g <= b1_g; s2_ev <= b1_ev; s2_q <= s1_q;
          // ---- S2a -> S2b ----
          p2_v <= s2_v; p2_first <= s2_first; p2_lastg <= s2_lastg; p2_half <= s2_half; p2_g <= s2_g; p2_ev <= s2_ev;
          p2_q <= qst; p2_ql <= qln; p2_sl <= slsum; p2_cnt <= cnt; p2_fc <= fc; p2_lc <= lc; p2_fnd <= fnd;
          // ---- S2b ----
          if (p2_v) begin
            n_acc <= n2; pp_acc <= pp2; sp_acc <= sp2; dn_acc <= dn2; nr_acc <= nr2 + (rec_we ? 1'b1 : 1'b0);
          end
          cl_v <= p2_v && p2_lastg; cl_half <= p2_half; cl_n <= n2; cl_sp <= sp2; cl_dn <= dn2; cl_nr <= nr2 + (rec_we ? 1'b1 : 1'b0);
          // ---- S3 ----
          if (cl_v) begin
            dsc_n[cl_half] <= cl_n; dsc_nr[cl_half] <= cl_nr;
            dsc_dense[cl_half] <= alld || ({1'b0, cl_dn} + {5'd0, cfg_D} < {1'b0, cl_sp});
          end
          // ---- emitter ----
          if (st_go) begin
            e_left <= dsc_n[eh]; e_dense <= dsc_dense[eh]; e_rleft <= dsc_nr[eh]; e_fresh <= 1'b1;
            e_last <= 0; e_g <= 0; e_lane <= 0; es_body <= !fin;
          end else if (body_sp) begin
            if (!take2) begin
              e_left <= e_left - 1'b1; e_last <= sb1;
              if (!same2) e_fresh <= 1'b1; else begin e_rem <= m2; e_cnt <= ecnt - 1'b1; e_fresh <= 1'b0; end
            end else begin
              e_left <= e_left - 2'd2; e_last <= sb2;
              if (m3z) e_fresh <= 1'b1; else begin e_rem <= m3; e_cnt <= same2 ? ecnt - 2'd2 : rc1 - 1'b1; e_fresh <= 1'b0; end
            end
            if (fin) es_body <= 1'b0;
          end else if (body_dn) begin
            if (d_gdone) begin
              e_g <= e_g + 1'b1; e_lane <= 0;
              if (d_match) e_rleft <= e_rleft - 1'b1;
            end else e_lane <= e_lane + W;
            if (fin) es_body <= 1'b0;
          end
          // ---- record prefetch FIFO (push <= 1, pop <= 2 per cycle) ----
          rv <= r_en;
          if (r_en) pf_i <= pf_i + 1'b1;
          if (!pf_on) begin
            if (pf_f < e_f) pf_f <= pf_f + 1;                                 // frame already emitted (no records)
            else if (pf_f < c_T && pf_ok && dvalid[pf_f[0]]) begin pf_on <= 1'b1; pf_n <= dsc_nr[pf_f[0]]; pf_i <= 0; end
          end else if (pf_i == pf_n) begin pf_on <= 1'b0; pf_f <= pf_f + 1; end
          fq0 <= (f_pop == 2'd0) ? ((fcnt > 3'd0) ? fq0 : rrec) : (f_pop == 2'd1) ? ((fcnt > 3'd1) ? fq1 : rrec) : ((fcnt > 3'd2) ? fq2 : rrec);
          fq1 <= (f_pop == 2'd0) ? ((fcnt > 3'd1) ? fq1 : rrec) : (f_pop == 2'd1) ? ((fcnt > 3'd2) ? fq2 : rrec) : ((fcnt > 3'd3) ? fq3 : rrec);
          fq2 <= (f_pop == 2'd0) ? ((fcnt > 3'd2) ? fq2 : rrec) : (f_pop == 2'd1) ? ((fcnt > 3'd3) ? fq3 : rrec) : rrec;
          fq3 <= (f_pop == 2'd0) ? ((fcnt > 3'd3) ? fq3 : rrec) : rrec;
          fcnt <= fcnt + {2'd0, rv} - {1'b0, f_pop};
          if (fin) begin e_f <= e_f + 1; if (e_f + 1 == c_T) emit_done <= 1'b1; end
          // ---- frame-buffer ownership ----
          begin : own
            reg [1:0] hb, dv;
            hb = hbusy; dv = dvalid;
            if (fin) begin hb[eh] = 1'b0; dv[eh] = 1'b0; end
            if (take && a_g == 0) hb[a_t[0]] = 1'b1;
            if (cl_v) dv[cl_half] = 1'b1;
            hbusy <= hb; dvalid <= dv;
          end
          if (flush && bcnt == 0) begin done <= 1'b1; st <= T_DONE; end
        end
        default: ;
      endcase
    end
  end
  /* verilator lint_on WIDTHTRUNC */
  /* verilator lint_on WIDTHEXPAND */
endmodule
`default_nettype wire

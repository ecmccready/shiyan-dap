// TEST ONLY. 4D-SCP v0.1.14 — temporal-only S4DI v1 ENCODER (rank 0, relations off; zero / last /
// linear hold), L integer codes in and W stream bytes out per cycle. Byte-exact with the v0.1.10
// integer model (scripts/scp-v0110-int-scp4d.ts encodeIntScp4d) for a fixed configuration.
`timescale 1ns/1ps
//
// Input: integer codes x (post-quantizer: x = round(v / g), g = eps / 2^G; the v0.1.8 ingest
// quantizer stays on the host / a separate front stage and is NOT in this module). Codes arrive
// frame-major in beats of up to L consecutive elements (beat k of a frame = elements kL..kL+L-1;
// the last beat of a frame is partial when L does not divide D; beats never straddle frames).
// The configuration is FIXED by the host (no config search): shape, T, G, predictor are sampled
// on `start`. The host also supplies the two opaque, setup-only header segments (the 8·C eps
// float64 bit patterns and the times / meta varints, cfg_tm_len bytes) on the hdr port; the encoder
// writes every other header byte itself (magic, version, T, shape, G, rank 0, relations 0,
// predictor, FW 16, layout byte).
//
// Structure (all engines run concurrently in RUN):
//   header engine  : fixed fields W bytes / cycle, host segments one hdr beat / cycle
//   analysis       : S0 accept beat + sync-read H1 / H2 (L banks; element e in bank e mod L)
//                    S1 predict, residual, deadband test, q, reconstruction, state write (forward
//                       the previous cycle's write: same bank address only across a frame edge)
//                    S2 varint sizing (sparse / dense), event record write (one record per beat
//                       with >= 1 event: {group, mask, q[L]}) into the frame's half of a
//                       double-buffered record memory
//                    S3 frame close: layout decision (dense iff denseSize < sparseSize; every frame
//                       dense when D <= 8), frame descriptor {n, dense, nrec}
//   prefetch       : reads the emitted frame's records in order into a 3-entry register FIFO
//   emitter        : one START cycle per frame (head varint 2n + dense unless all-dense), then
//                    sparse: one event (gap, q) per cycle, or dense: W elements (svarint q,
//                    0 = hold) per cycle
//   byte queue     : BQ = 16 bytes behind a one-entry append stage (cuts the emitter -> queue
//                    path); an append needs bcnt + staged + len <= BQ on registered counts;
//                    out beats are full W bytes except the stream's last beat.
// Frame t+1 is analysed while frame t is emitted; frame t+2 waits until frame t is emitted.
//
// Error codes (err = 1, sticky; the encoder stops): 1 D = 0 or D > 2^ADDR_W, 2 T = 0, 3 G > G_MAX,
// 4 predictor = 3, 5 cfg_tm_len < T + 1, 6 register overflow (pred, residual or reconstruction
// leaves signed 32 bits), 7 input beat lane count != expected, 8 host header beat overruns its
// segment (or 0 / > W bytes).
//
// Plain Verilog-2005. No floating point, no division, no hashing, no initial blocks.
`default_nettype none
module scp4d_tenc_w #(
  parameter integer W      = 2,    // output bytes per cycle: 1 or 2
  parameter integer L      = 2,    // input codes per cycle (lanes / state banks): 1, 2, 4 or 8, L >= W
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
  localparam integer BQ = 16;
  localparam integer MA = (5 * W > 7) ? 5 * W : 7; // max bytes appended per cycle
  localparam integer RW = GA + L + 32 * L;        // record: {group, mask, q[L]}
  localparam [ADDR_W:0] MAXD = 1 << ADDR_W;
  localparam [5:0] BQ6 = BQ[5:0], W6 = W[5:0];
  localparam [4:0] W5 = W[4:0];
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
  reg  [4:0] bcnt;
  reg        emit_done;
  reg  [3:0] app_n;                // this cycle's append (registered into the stage below)
  reg  [8*MA-1:0] app_b;
  reg  [3:0] stg_n;                // staged append: written into the queue on the next edge
  reg  [8*MA-1:0] stg_b;
  wire [5:0] bsum = {1'b0, bcnt} + {2'd0, stg_n};   // queue + stage occupancy (append space check)
  wire       flush = emit_done && (stg_n == 4'd0);
  assign out_valid  = run && ((bcnt >= W5) || (flush && bcnt != 5'd0));
  assign out_nbytes = (bcnt >= W5) ? W[2:0] : bcnt[2:0];
  genvar gw;
  generate for (gw = 0; gw < W; gw = gw + 1) begin : ob
    assign out_data[8*gw +: 8] = bq[gw];
  end endgenerate
  wire [4:0] pop  = (out_valid && out_ready) ? {2'd0, out_nbytes} : 5'd0;
  wire [4:0] keep = bcnt - pop;

  // ---------------- varint helpers ----------------
  /* verilator lint_off UNUSEDSIGNAL */
  function [2:0] vlen;            // LEB128 length of a 35-bit unsigned value (<= 5 bytes for < 2^35)
    input [34:0] v;
    begin
      vlen = (v[34:28] != 0) ? 3'd5 : (v[27:21] != 0) ? 3'd4 : (v[20:14] != 0) ? 3'd3 : (v[13:7] != 0) ? 3'd2 : 3'd1;
    end
  endfunction
  /* verilator lint_on UNUSEDSIGNAL */
  function [39:0] vbytes;         // LEB128 bytes (byte 0 first), continuation bits from vlen
    input [34:0] v;
    reg [2:0] n;
    begin
      n = vlen(v);
      vbytes = {1'b0, v[34:28], (n > 3'd4), v[27:21], (n > 3'd3), v[20:14], (n > 3'd2), v[13:7], (n > 3'd1), v[6:0]};
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
  wire        hspace  = (bsum + W6 <= BQ6);
  wire        host_seg = (hseg == H_EPS) || (hseg == H_TM);
  assign hdr_ready = run && !err && host_seg && hspace;
  wire [135:0] f1v = {c_c, c_nz, c_ny, c_nx, c_T, 8'd1, 8'h49, 8'h44, 8'h34, 8'h53};   // byte 0 = 'S'
  wire [39:0]  f3v = {7'd0, alld, 8'd16, 6'd0, c_pred, 8'd0, 8'd0};
  function [7:0] fbyte;
    input [2:0] seg; input [4:0] idx; input [135:0] a; input [39:0] c; input [4:0] g;
    begin
      if (seg == H_F1) fbyte = a[8*idx +: 8];
      else if (seg == H_F2) fbyte = {3'd0, g};
      else fbyte = c[8*idx[2:0] +: 8];
    end
  endfunction
  /* verilator lint_off WIDTHTRUNC */
  wire [2:0] fix_n = (seg_rem < W) ? seg_rem[2:0] : W[2:0];
  /* verilator lint_on WIDTHTRUNC */

  // ---------------- analysis: S0 ----------------
  reg [31:0] a_t;
  reg [GA:0] a_g;
  reg [1:0]  hbusy;
  wire a_lastg = (a_g == ngroups - 1'b1);
  wire acc_ok  = run && !err && (a_t < c_T) && ((a_g != 0) || !hbusy[a_t[0]]);
  assign in_ready = acc_ok;
  wire take = in_valid && acc_ok;
  /* verilator lint_off WIDTHEXPAND */
  /* verilator lint_off WIDTHTRUNC */
  wire [3:0] exp_n = a_lastg ? lastn : L[3:0];
  /* verilator lint_on WIDTHTRUNC */
  /* verilator lint_on WIDTHEXPAND */
  wire [GA-1:0] raddr = a_g[GA-1:0];

  // S1 registers
  reg            s1_v, s1_t0, s1_t2, s1_first, s1_lastg, s1_half;
  reg [GA:0]     s1_g;
  reg [3:0]      s1_n;
  reg [32*L-1:0] s1_x;
  // forwarding of the previous cycle's state write
  reg            fw_v;
  reg [GA:0]     fw_g;
  reg [L-1:0]    fw_we1, fw_we2;
  reg [32*L-1:0] fw_h1, fw_h2;
  // memories
  wire [32*L-1:0] h1r, h2r;
  reg  [L-1:0]    we1, we2;
  reg  [32*L-1:0] wd1, wd2;
  genvar gb;
  generate for (gb = 0; gb < L; gb = gb + 1) begin : bank
    reg [31:0] m1 [0:(1<<GA)-1];
    reg [31:0] m2 [0:(1<<GA)-1];
    reg [31:0] r1, r2;
    always @(posedge clk) begin
      if (we1[gb]) m1[s1_g[GA-1:0]] <= wd1[32*gb +: 32];
      if (take) r1 <= m1[raddr];
    end
    always @(posedge clk) begin
      if (we2[gb]) m2[s1_g[GA-1:0]] <= wd2[32*gb +: 32];
      if (take) r2 <= m2[raddr];
    end
    assign h1r[32*gb +: 32] = r1;
    assign h2r[32*gb +: 32] = r2;
  end endgenerate

  // ---------------- S1: predict / residual / quantize / write ----------------
  reg [L-1:0]    s1_ev, s1_ovf;
  reg [32*L-1:0] s1_q;
  reg signed [33:0] h1s, h2s, pr;
  reg signed [34:0] xs, rr, cn;
  reg signed [35:0] rh;
  /* verilator lint_off UNUSEDSIGNAL */
  reg signed [35:0] qq;            // q = qq[31:0] (fits: |r| < 2^31 is checked)
  /* verilator lint_on UNUSEDSIGNAL */
  reg               lv;
  integer b;
  always @(*) begin
    we1 = 0; we2 = 0; wd1 = 0; wd2 = 0; s1_ev = 0; s1_ovf = 0; s1_q = 0;
    h1s = 0; h2s = 0; pr = 0; xs = 0; rr = 0; cn = 0; rh = 0; qq = 0; lv = 1'b0;
    for (b = 0; b < L; b = b + 1) begin
      lv  = s1_v && (b < s1_n);
      h1s = s1_t0 ? 34'sd0 : $signed({{2{((fw_v && fw_g == s1_g && fw_we1[b]) ? fw_h1[32*b+31] : h1r[32*b+31])}}, ((fw_v && fw_g == s1_g && fw_we1[b]) ? fw_h1[32*b +: 32] : h1r[32*b +: 32])});
      h2s = s1_t0 ? 34'sd0 : $signed({{2{((fw_v && fw_g == s1_g && fw_we2[b]) ? fw_h2[32*b+31] : h2r[32*b+31])}}, ((fw_v && fw_g == s1_g && fw_we2[b]) ? fw_h2[32*b +: 32] : h2r[32*b +: 32])});
      if (lst) pr = h1s;
      else if (lin) pr = s1_t2 ? (h1s + h1s - h2s) : h1s;
      else pr = 34'sd0;
      xs = $signed({{3{s1_x[32*b+31]}}, s1_x[32*b +: 32]});
      rr = xs - {pr[33], pr};
      s1_ev[b] = lv && ((rr > $signed({18'd0, kk})) || (rr < -$signed({18'd0, kk})));
      rh = {rr[34], rr} + $signed({19'd0, halfg});
      qq = rh >>> c_G;
      cn = $signed({pr[33], pr}) + (s1_ev[b] ? $signed(rh[34:0] & ~{18'd0, kk}) : 35'sd0);
      s1_q[32*b +: 32] = qq[31:0];
      s1_ovf[b] = lv && ((pr[33:31] != {3{pr[31]}}) || (rr[34:31] != {4{rr[31]}}) || (cn[34:31] != {4{cn[31]}}));
      we1[b] = lv && (lin || (lst && (s1_ev[b] || s1_t0)));
      we2[b] = lv && lin;
      wd1[32*b +: 32] = cn[31:0];
      wd2[32*b +: 32] = h1s[31:0];
    end
  end
  wire any_ovf = |s1_ovf;
  reg  ovf_r;

  // ---------------- S2: sizing + record write ----------------
  reg            s2_v, s2_first, s2_lastg, s2_half;
  reg [GA:0]     s2_g;
  reg [L-1:0]    s2_ev;
  reg [32*L-1:0] s2_q;
  reg [ADDR_W:0] n_acc, pp_acc;
  reg [15:0]     sp_acc, dn_acc;
  reg [GA:0]     nr_acc;
  reg [ADDR_W:0] n2, pp2, pin, gbase, gap;
  reg [15:0]     sp2, dn2;
  reg [2:0]      sl;
  reg [5:0]      slsum;              // <= 8 * 5
  reg [LL+1:0]   cnt;
  reg [LL:0]     fc, lc;
  reg            fnd, big;
  reg [32*L-1:0] qst;
  integer c;
  // Only the first event of a group can have a gap >= 128 (later gaps are < L); so the per-beat
  // sizes are a popcount + a sum of varint lengths + one wide subtraction (no serial gap chain).
  always @(*) begin
    pin = s2_first ? 0 : pp_acc;
    /* verilator lint_off WIDTHEXPAND */
    gbase = s2_g;
    /* verilator lint_on WIDTHEXPAND */
    gbase = gbase << LL;
    qst = 0; sl = 0; slsum = 0; cnt = 0; fc = 0; lc = 0; fnd = 1'b0;
    for (c = 0; c < L; c = c + 1) begin
      if (s2_ev[c]) begin
        sl    = vlen(zz(s2_q[32*c +: 32]));
        slsum = slsum + {3'd0, sl};
        cnt   = cnt + 1'b1;
        if (!fnd) fc = c[LL:0];
        fnd   = 1'b1;
        lc    = c[LL:0];
        qst[32*c +: 32] = s2_q[32*c +: 32];
      end
    end
    /* verilator lint_off WIDTHEXPAND */
    gap = (gbase | fc) - pin;
    big = fnd && (gap >= 128);
    sp2 = (s2_first ? 16'd0 : sp_acc) + cnt + slsum + big;
    dn2 = (s2_first ? 16'd0 : dn_acc) + slsum - cnt;
    n2  = (s2_first ? 0 : n_acc) + cnt;
    pp2 = fnd ? ((gbase | lc) + 1'b1) : pin;
    /* verilator lint_on WIDTHEXPAND */
  end
  wire [GA:0] nr2 = s2_first ? 0 : nr_acc;
  wire        rec_we = s2_v && (s2_ev != 0);
  reg  [RW-1:0] recm [0:(2<<GA)-1];
  reg  [RW-1:0] rrec;
  wire          r_en;
  wire [GA:0]   r_addr;
  always @(posedge clk) begin
    if (rec_we) recm[{s2_half, nr2[GA-1:0]}] <= {s2_g[GA-1:0], s2_ev, qst};
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
  reg [ADDR_W:0] e_left, e_pp;
  reg            e_dense, e_fresh;
  reg [GA:0]     e_rleft, e_g;
  reg [LL:0]     e_lane;
  reg [L-1:0]    e_rem;
  wire           eh = e_f[0];
  // record prefetch: sequential reads of the emitted frame's records into a 3-entry register FIFO
  // (issue iff fcnt + rv <= 2 on registered counts), so the emitter never sees the RAM output
  reg  [31:0]    pf_f;
  reg  [GA:0]    pf_i, pf_n;
  reg            pf_on, rv;
  reg  [RW-1:0]  fq0, fq1, fq2;
  reg  [1:0]     fcnt;
  wire           pf_ok = (pf_f == e_f) || (pf_f == e_f + 1);
  assign r_en   = run && !err && pf_on && (pf_i != pf_n) && ({1'b0, fcnt} + {2'd0, rv} <= 3'd2);
  assign r_addr = {pf_f[0], pf_i[GA-1:0]};
  wire           hd_v = (fcnt != 2'd0);
  wire [GA-1:0]  rec_g = fq0[RW-1 -: GA];
  wire [L-1:0]   rec_m = fq0[32*L +: L];
  // START
  wire [ADDR_W+1:0] hv = {dsc_n[eh], dsc_dense[eh]};
  wire [2:0]     hlen = alld ? 3'd0 : (hv >= 128) ? 3'd2 : 3'd1;
  wire           st_go = run && !err && hdr_done && !emit_done && !es_body && dvalid[eh] && (bsum + {3'd0, hlen} <= BQ6);
  // sparse body
  wire [L-1:0]   sm = e_fresh ? rec_m : e_rem;
  reg  [LL:0]    sb;
  integer k;
  always @(*) begin
    sb = 0;
    for (k = L - 1; k >= 0; k = k - 1) if (sm[k]) sb = k[LL:0];
  end
  /* verilator lint_off WIDTHEXPAND */
  wire [ADDR_W:0] s_pos = (rec_g << LL) + sb;
  /* verilator lint_on WIDTHEXPAND */
  wire [ADDR_W:0] s_gap = s_pos - e_pp;
  wire [31:0]     s_q   = fq0[32*sb +: 32];
  wire [34:0]     s_z   = zz(s_q);
  wire [2:0]      s_gl  = (s_gap >= 128) ? 3'd2 : 3'd1;
  wire [2:0]      s_ql  = vlen(s_z);
  wire [3:0]      s_n   = {1'b0, s_gl} + {1'b0, s_ql};
  wire [L-1:0]    one_l = 1;
  wire [L-1:0]    s_m2  = sm & ~(one_l << sb);
  // dense body
  wire [LL:0]     d_ln  = (e_g == ngroups - 1'b1) ? lastn : L[LL:0];
  wire            d_need  = (e_rleft != 0);
  wire            d_match = d_need && (rec_g == e_g[GA-1:0]);
  reg  [3:0]      d_n;
  reg  [8*MA-1:0] d_b;
  reg  [31:0]     dq;
  reg  [2:0]      dl;
  integer w;
  /* verilator lint_off WIDTHEXPAND */
  always @(*) begin
    d_n = 0; d_b = 0; dq = 0; dl = 0;
    for (w = 0; w < W; w = w + 1) begin
      if (e_lane + w < d_ln) begin
        dq = d_match ? fq0[32*(e_lane + w) +: 32] : 32'd0;
        dl = vlen(zz(dq));
        d_b = d_b | ({{(8*MA-40){1'b0}}, vbytes(zz(dq))} << {d_n, 3'b000});
        d_n = d_n + {1'b0, dl};
      end
    end
  end
  /* verilator lint_on WIDTHEXPAND */
  wire            body_sp = run && !err && es_body && !e_dense && hd_v && (bsum + {2'd0, s_n} <= BQ6);
  wire            body_dn = run && !err && es_body && e_dense && (hd_v || !d_need) && (bsum + {2'd0, d_n} <= BQ6);
  wire            d_gdone = ({1'b0, e_lane} + W[LL+1:0] >= {1'b0, d_ln});
  wire            f_pop = (body_sp && s_m2 == 0) || (body_dn && d_gdone && d_match);
  wire            fin = (st_go && !dsc_dense[eh] && dsc_n[eh] == 0) || (body_sp && e_left == 1) || (body_dn && d_gdone && e_g == ngroups - 1'b1);

  // append source + record read port
  integer m;
  always @(*) begin
    app_n = 0; app_b = 0;
    if (run && !err && !hdr_done) begin
      if (!host_seg && hspace) begin
        app_n = {1'b0, fix_n};
        for (m = 0; m < W; m = m + 1) app_b[8*m +: 8] = fbyte(hseg, hcnt[4:0] + m[4:0], f1v, f3v, c_G);
      end else if (host_seg && hdr_valid && hspace) begin
        app_n = {1'b0, hdr_nbytes};
        app_b[8*W-1:0] = hdr_data;
      end
    end else if (st_go) begin
      app_n = {1'b0, hlen};
      app_b[39:0] = vbytes({{(34-ADDR_W-1){1'b0}}, hv});
    end else if (body_sp) begin
      app_n = s_n;
      app_b = {{(8*MA-40){1'b0}}, vbytes({{(35-ADDR_W-1){1'b0}}, s_gap})} | ({{(8*MA-40){1'b0}}, vbytes(s_z)} << {s_gl, 3'b000});
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
      p_acc <= 0; p_big <= 1'b0; ngroups <= 0; lastn <= 0; alld <= 1'b0; kk <= 0; halfg <= 0;
      bcnt <= 0; stg_n <= 0; stg_b <= 0; emit_done <= 1'b0; hseg <= H_F1; hcnt <= 0; hdr_done <= 1'b0;
      for (j = 0; j < BQ; j = j + 1) bq[j] <= 8'd0;
      a_t <= 0; a_g <= 0; hbusy <= 2'b00;
      s1_v <= 1'b0; s1_t0 <= 1'b0; s1_t2 <= 1'b0; s1_first <= 1'b0; s1_lastg <= 1'b0; s1_half <= 1'b0; s1_g <= 0; s1_n <= 0; s1_x <= 0;
      fw_v <= 1'b0; fw_g <= 0; fw_we1 <= 0; fw_we2 <= 0; fw_h1 <= 0; fw_h2 <= 0;
      s2_v <= 1'b0; s2_first <= 1'b0; s2_lastg <= 1'b0; s2_half <= 1'b0; s2_g <= 0; s2_ev <= 0; s2_q <= 0;
      ovf_r <= 1'b0;
      n_acc <= 0; pp_acc <= 0; sp_acc <= 0; dn_acc <= 0; nr_acc <= 0;
      cl_v <= 1'b0; cl_half <= 1'b0; cl_n <= 0; cl_sp <= 0; cl_dn <= 0; cl_nr <= 0; dvalid <= 2'b00;
      dsc_n[0] <= 0; dsc_n[1] <= 0; dsc_dense[0] <= 1'b0; dsc_dense[1] <= 1'b0; dsc_nr[0] <= 0; dsc_nr[1] <= 0;
      es_body <= 1'b0; e_f <= 0; e_left <= 0; e_pp <= 0; e_dense <= 1'b0; e_fresh <= 1'b0; e_rleft <= 0; e_g <= 0;
      pf_f <= 0; pf_i <= 0; pf_n <= 0; pf_on <= 1'b0; rv <= 1'b0; fcnt <= 2'd0; fq0 <= 0; fq1 <= 0; fq2 <= 0; e_lane <= 0; e_rem <= 0;
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
          bcnt <= keep + stg_n;
          stg_n <= app_n; stg_b <= app_b;
          // ---- header ----
          if (!hdr_done) begin
            if (!host_seg && hspace) begin
              if (hcnt + fix_n == seg_len) begin hcnt <= 0; hseg <= hseg + 3'd1; if (hseg == H_F3) hdr_done <= 1'b1; end
              else hcnt <= hcnt + fix_n;
            end else if (host_seg && hdr_valid && hspace) begin
              if (hdr_nbytes == 0 || hdr_nbytes > W || {29'd0, hdr_nbytes} > seg_rem) begin err <= 1'b1; err_code <= E_HDR; st <= T_ERR; end
              else if (hcnt + hdr_nbytes == seg_len) begin hcnt <= 0; hseg <= hseg + 3'd1; end
              else hcnt <= hcnt + hdr_nbytes;
            end
          end
          // ---- S0 ----
          s1_v <= take;
          if (take) begin
            if (in_n != exp_n) begin err <= 1'b1; err_code <= E_BEAT; st <= T_ERR; end
            s1_x <= in_x; s1_g <= a_g; s1_n <= exp_n; s1_t0 <= (a_t == 0); s1_t2 <= (a_t >= 2); s1_first <= (a_g == 0); s1_lastg <= a_lastg; s1_half <= a_t[0];
            if (a_lastg) begin a_g <= 0; a_t <= a_t + 1; end else a_g <= a_g + 1'b1;
          end
          // ---- S1 ----
          fw_v <= s1_v; fw_g <= s1_g; fw_we1 <= we1; fw_we2 <= we2; fw_h1 <= wd1; fw_h2 <= wd2;
          // overflow is registered (ovf_r) and raised one cycle later: the overflowing frame cannot
          // reach S3 / the emitter before the core stops (close is two stages behind S1).
          ovf_r <= s1_v && any_ovf;
          if (ovf_r) begin err <= 1'b1; err_code <= E_OVF; st <= T_ERR; end
          s2_v <= s1_v; s2_first <= s1_first; s2_lastg <= s1_lastg; s2_half <= s1_half; s2_g <= s1_g; s2_ev <= s1_ev; s2_q <= s1_q;
          // ---- S2 ----
          if (s2_v) begin
            n_acc <= n2; pp_acc <= pp2; sp_acc <= sp2; dn_acc <= dn2; nr_acc <= nr2 + (rec_we ? 1'b1 : 1'b0);
          end
          cl_v <= s2_v && s2_lastg; cl_half <= s2_half; cl_n <= n2; cl_sp <= sp2; cl_dn <= dn2; cl_nr <= nr2 + (rec_we ? 1'b1 : 1'b0);
          // ---- S3 ----
          if (cl_v) begin
            dsc_n[cl_half] <= cl_n; dsc_nr[cl_half] <= cl_nr;
            dsc_dense[cl_half] <= alld || ({1'b0, cl_dn} + {5'd0, cfg_D} < {1'b0, cl_sp});
          end
          // ---- emitter ----
          if (st_go) begin
            e_left <= dsc_n[eh]; e_dense <= dsc_dense[eh]; e_rleft <= dsc_nr[eh]; e_fresh <= 1'b1;
            e_pp <= 0; e_g <= 0; e_lane <= 0; es_body <= !fin;
          end else if (body_sp) begin
            e_left <= e_left - 1'b1; e_pp <= s_pos + 1'b1;
            if (s_m2 == 0) e_fresh <= 1'b1; else begin e_rem <= s_m2; e_fresh <= 1'b0; end
            if (fin) es_body <= 1'b0;
          end else if (body_dn) begin
            if (d_gdone) begin
              e_g <= e_g + 1'b1; e_lane <= 0;
              if (d_match) e_rleft <= e_rleft - 1'b1;
            end else e_lane <= e_lane + W;
            if (fin) es_body <= 1'b0;
          end
          // ---- record prefetch FIFO ----
          rv <= r_en;
          if (r_en) pf_i <= pf_i + 1'b1;
          if (!pf_on) begin
            if (pf_f < e_f) pf_f <= pf_f + 1;                                 // frame already emitted (no records)
            else if (pf_f < c_T && pf_ok && dvalid[pf_f[0]]) begin pf_on <= 1'b1; pf_n <= dsc_nr[pf_f[0]]; pf_i <= 0; end
          end else if (pf_i == pf_n) begin pf_on <= 1'b0; pf_f <= pf_f + 1; end
          case ({f_pop, rv})
            2'b10: begin fq0 <= fq1; fq1 <= fq2; fcnt <= fcnt - 1'b1; end
            2'b01: begin
              if (fcnt == 2'd0) fq0 <= rrec; else if (fcnt == 2'd1) fq1 <= rrec; else fq2 <= rrec;
              fcnt <= fcnt + 1'b1;
            end
            2'b11: begin fq0 <= (fcnt == 2'd1) ? rrec : fq1; fq1 <= (fcnt == 2'd2) ? rrec : fq2; fq2 <= rrec; end
            default: ;
          endcase
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

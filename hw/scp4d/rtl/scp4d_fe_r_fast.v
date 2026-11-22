// TEST ONLY. v0.1.25 copy of scp4d_fe_r_share. scp4d_fe_r_share.v is not edited.
// One cut: the token-queue shift uses pop_q, the previous cycle's t_pop, and
// tokenization pauses while q_hold is high. Same token results, one cycle later
// on every pop.
`timescale 1ns/1ps
//
//   1. Token pre-decode against the frame size. When a token enters the queue it also gets the
//      flags and narrow fields the decoder's issue chain needs (dense bit, head count == 0,
//      head count > D, value >= D, value low bits, head count and head count − 1, and
//      (D − 1) − value for the gap range check), computed from lim_D / lim_Dm1 (the decoder's
//      registered header D and D − 1, stable before token mode starts). The chain then does no
//      35-bit compare or add.
//   2. Pop-late queue update. For every possible pop count p = 0..K the next contents of each
//      queue entry and the next occupancy are formed from registered state only; the consumer's
//      pop count t_pop (the end of its issue chain) selects among them in the last mux level.
//
// Token entry (packed, EW bits, LSB first): dmg (ADDR_W+2, signed (D − 1) − lo), lo (ADDR_W+1,
// value low bits), ge (value >= D), nm1 (head count − 1), n (head count = value[ADDR_W+1:1]),
// hbig (value[34:1] > D), hz (value[34:1] == 0), dn (value[0]), big, nz, q (32, zigzag), long,
// len (3). Offsets are the O_* localparams below (repeated in scp4d_tdec_r.v).
//
// Plain Verilog-2005. No floating point, no division, no hashing, no initial blocks.
`default_nettype none
module scp4d_fe_r_fast #(
  parameter integer W      = 2,           // input bytes per cycle (1, 2 or 4)
  parameter integer K      = 2,           // tokens visible / poppable per cycle
  parameter integer ADDR_W = 11,
  parameter integer BQ     = 2 * W,       // byte queue depth
  parameter integer TQ     = 2 * W + K    // token queue depth
) (
  input  wire                 clk,
  input  wire                 rst,
  input  wire [8*W-1:0]       in_data,
  input  wire [2:0]           in_nbytes,
  input  wire                 in_valid,
  output wire                 in_ready,
  // byte mode
  output wire                 b_avail,
  output wire [7:0]           b_data,
  input  wire                 b_pop,
  // token mode
  input  wire                 tok_mode,
  input  wire [ADDR_W:0]      lim_D,      // frame size D (registered by the consumer)
  input  wire [ADDR_W:0]      lim_Dm1,    // D − 1
  output wire [4:0]           t_cnt,
  output wire [(4*ADDR_W+47)*K-1:0] t_ent,
  input  wire [2:0]           t_pop,
  input  wire                 q_hold
);
  localparam integer AW = ADDR_W;
  localparam integer O_DMG = 0, O_LO = AW + 2, O_GE = 2*AW + 3, O_NM1 = 2*AW + 4, O_N = 3*AW + 5,
                     O_HBIG = 4*AW + 6, O_HZ = 4*AW + 7, O_DN = 4*AW + 8, O_BIG = 4*AW + 9, O_NZ = 4*AW + 10,
                     O_Q = 4*AW + 11, O_LONG = 4*AW + 43, O_LEN = 4*AW + 44, EW = 4*AW + 47;
  localparam [4:0] W5 = W[4:0], BQ5 = BQ[4:0], TQ5 = TQ[4:0];
  // ---------------- byte queue ----------------
  reg [7:0] bq [0:BQ-1];
  reg [4:0] bcnt;
  assign in_ready = !rst && (bcnt + W5 <= BQ5);
  wire      push_b = in_valid && in_ready;
  assign b_avail = !tok_mode && (bcnt != 5'd0);
  assign b_data  = bq[0];

  // ---------------- token queue ----------------
  reg [EW-1:0] tq [0:TQ-1];
  reg [4:0]    tcnt;
  reg [34:0]   vacc;
  reg [2:0]    vsh;
  assign t_cnt = tcnt;
  genvar gk;
  generate for (gk = 0; gk < K; gk = gk + 1) begin : tview
    assign t_ent[EW*gk +: EW] = tq[gk];
  end endgenerate

  // token entry: the v0.1.13 pre-decode (q, nz, big) plus the range flags / narrow fields
  function [EW-1:0] mkent(input [34:0] a, input [2:0] ln, input lg, input [AW:0] d, input [AW:0] dm1);
    reg [AW:0]   lo, n, nm1;
    reg [AW+1:0] dmg;
    begin
      lo = a[AW:0]; n = a[AW+1:1]; nm1 = n - 1'b1;
      dmg = {1'b0, dm1} - {1'b0, lo};
      mkent = {ln, lg, (a[0] ? ~a[32:1] : a[32:1]), (a != 35'd0), (a[34:32] != 3'd0), a[0], (a[34:1] == 34'd0),
               (a[34:1] > {{(34-AW-1){1'b0}}, d}), n, nm1, ({1'b0, a} >= {{(35-AW){1'b0}}, d}), lo, dmg};
    end
  endfunction

  // ---------------- tokenizer (combinational over the first W queued bytes; as scp4d_fe_w) ----------------
  wire       tk_en = tok_mode && !q_hold && (tcnt + W5 <= TQ5);
  reg  [2:0] pop_q;
  reg  [4:0] tk_n;                    // bytes taken from the byte queue this cycle
  reg  [4:0] nt;                      // tokens produced this cycle
  reg  [EW-1:0] ne [0:W-1];
  reg  [34:0] a, sb;
  reg  [2:0]  s;
  reg  [34:0] n_vacc;
  reg  [2:0]  n_vsh;
  integer i;
  /* verilator lint_off WIDTHTRUNC */   // nt indexes a W-entry array (nt < W whenever it is used)
  always @(*) begin
    tk_n = 5'd0; nt = 5'd0; a = vacc; s = vsh; sb = 35'd0;
    for (i = 0; i < W; i = i + 1) ne[i] = {EW{1'b0}};
    if (tk_en) begin
      for (i = 0; i < W; i = i + 1) begin
        if (i < bcnt) begin
          tk_n = tk_n + 5'd1;
          case (s)
            3'd0: sb = {28'd0, bq[i][6:0]};
            3'd1: sb = {21'd0, bq[i][6:0], 7'd0};
            3'd2: sb = {14'd0, bq[i][6:0], 14'd0};
            3'd3: sb = {7'd0, bq[i][6:0], 21'd0};
            default: sb = {bq[i][6:0], 28'd0};
          endcase
          a = a | sb;
          if (!bq[i][7] || s == 3'd4) begin
            ne[nt[1:0]] = mkent(a, s + 3'd1, bq[i][7], lim_D, lim_Dm1);
            nt = nt + 5'd1; a = 35'd0; s = 3'd0;
          end else s = s + 3'd1;
        end
      end
    end
    n_vacc = a; n_vsh = s;
  end
  /* verilator lint_on WIDTHTRUNC */

  // ---------------- queue updates ----------------
  // One shift of the token queue by t_pop, then the new tokens. Same result as the
  // v0.1.17 copy that precomputed a candidate queue for every pop count.
  wire [4:0] bpop  = tok_mode ? tk_n : {4'd0, b_pop && b_avail};
  wire [4:0] bkeep = bcnt - bpop;
  integer m;              // clocked-block loop indices (separate from the combinational p / j)
  /* verilator lint_off WIDTHEXPAND */
  /* verilator lint_off WIDTHTRUNC */
  always @(posedge clk) begin
    if (rst) begin
      bcnt <= 5'd0; tcnt <= 5'd0; vacc <= 35'd0; vsh <= 3'd0; pop_q <= 3'd0;
      for (m = 0; m < BQ; m = m + 1) bq[m] <= 8'd0;
      for (m = 0; m < TQ; m = m + 1) tq[m] <= {EW{1'b0}};
    end else begin
      for (m = 0; m < BQ; m = m + 1) begin
        if (m < bkeep) bq[m] <= bq[m + bpop];
        else if (push_b && (m - bkeep) < W) bq[m] <= in_data[8*(m - bkeep) +: 8];
      end
      bcnt <= bkeep + (push_b ? {2'd0, in_nbytes} : 5'd0);
      // The shift amount is the previous cycle's pop. q_hold captures it and
      // pauses tokenization so the queue the decoder classified stays put.
      pop_q <= q_hold ? t_pop : 3'd0;
      for (m = 0; m < TQ; m = m + 1) begin
        if (m < (tcnt - pop_q)) begin
          if ((m + pop_q) < TQ) tq[m] <= tq[m + pop_q];
        end else if ((m - (tcnt - pop_q)) < nt) tq[m] <= ne[m - (tcnt - pop_q)];
      end
      tcnt <= (tcnt - pop_q) + nt;
      if (tk_en) begin vacc <= n_vacc; vsh <= n_vsh; end
    end
  end
  /* verilator lint_on WIDTHTRUNC */
  /* verilator lint_on WIDTHEXPAND */
endmodule
`default_nettype wire

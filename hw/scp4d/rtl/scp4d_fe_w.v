// TEST ONLY. 4D-SCP v0.1.13 — W-byte input front end for the scp4d decoders (byte aligner + varint
// pre-decoder). Shared by scp4d_tdec_w.v and scp4d_rdec_w.v; the v0.1.11 / v0.1.12 decoders are
// unchanged and do not use it.
`timescale 1ns/1ps
//
// Input: one beat of up to W stream bytes per cycle (in_data byte 0 = first stream byte,
// in_nbytes = 1..W valid bytes, in_valid / in_ready). Two output views of the same byte stream:
//   byte mode  (tok_mode = 0): the head byte (b_avail / b_data), popped one per cycle with b_pop.
//              The S4DI v1 header is parsed in this mode (its fields are not all varints).
//   token mode (tok_mode = 1, set by the consumer once, after the header's layout byte): the
//              tokenizer turns up to W bytes per cycle into LEB128 varint tokens (35-bit value,
//              byte length, `long` flag for a payload varint that does not end within 5 bytes) and
//              pushes them into a token queue; the consumer sees the first K tokens (t_val / t_len /
//              t_long, t_cnt available) and pops 0..K of them per cycle with t_pop. Each token is
//              also pre-decoded as a zigzag q (t_q, t_nz, t_big) when it enters the queue, so the
//              consumer's per-token compares are registered one stage earlier.
// A varint may straddle beats; the tokenizer carries the partial value (vacc, vsh) across cycles.
// in_ready and the tokenizer's push enable depend only on registered occupancy counts (no
// combinational path from the consumer's pop decision back to the input), so the queues are sized
// with headroom: BQ = 2W bytes, TQ = 2W + K tokens.
//
// Plain Verilog-2005. No floating point, no division, no hashing, no initial blocks.
`default_nettype none
module scp4d_fe_w #(
  parameter integer W  = 2,           // input bytes per cycle (1, 2 or 4)
  parameter integer K  = 2,           // tokens visible / poppable per cycle
  parameter integer BQ = 2 * W,       // byte queue depth
  parameter integer TQ = 2 * W + K    // token queue depth
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
  output wire [4:0]           t_cnt,
  output wire [35*K-1:0]      t_val,
  output wire [3*K-1:0]       t_len,
  output wire [K-1:0]         t_long,
  output wire [32*K-1:0]      t_q,       // pre-decoded zigzag value (valid when !t_big)
  output wire [K-1:0]         t_nz,      // token value != 0 (q != 0)
  output wire [K-1:0]         t_big,     // zigzag magnitude does not fit signed 32 bits
  input  wire [2:0]           t_pop
);
  localparam [4:0] W5 = W[4:0], BQ5 = BQ[4:0], TQ5 = TQ[4:0];
  // ---------------- byte queue ----------------
  reg [7:0] bq [0:BQ-1];
  reg [4:0] bcnt;
  assign in_ready = !rst && (bcnt + W5 <= BQ5);
  wire      push_b = in_valid && in_ready;
  assign b_avail = !tok_mode && (bcnt != 5'd0);
  assign b_data  = bq[0];

  // ---------------- token queue ----------------
  reg [34:0] tq_v [0:TQ-1];
  reg [2:0]  tq_l [0:TQ-1];
  reg        tq_g [0:TQ-1];
  reg [31:0] tq_q [0:TQ-1];
  reg        tq_z [0:TQ-1];
  reg        tq_b [0:TQ-1];
  reg [4:0]  tcnt;
  reg [34:0] vacc;
  reg [2:0]  vsh;
  assign t_cnt = tcnt;
  genvar gk;
  generate for (gk = 0; gk < K; gk = gk + 1) begin : tview
    assign t_val[35*gk +: 35] = tq_v[gk];
    assign t_len[3*gk +: 3]   = tq_l[gk];
    assign t_long[gk]         = tq_g[gk];
    assign t_q[32*gk +: 32]   = tq_q[gk];
    assign t_nz[gk]           = tq_z[gk];
    assign t_big[gk]          = tq_b[gk];
  end endgenerate

  // ---------------- tokenizer (combinational over the first W queued bytes) ----------------
  wire       tk_en = tok_mode && (tcnt + W5 <= TQ5);
  reg  [4:0] tk_n;                    // bytes taken from the byte queue this cycle
  reg  [4:0] nt;                      // tokens produced this cycle
  reg  [34:0] nv [0:W-1];
  reg  [2:0]  nl [0:W-1];
  reg         ng [0:W-1];
  reg  [31:0] nq [0:W-1];
  reg         nzf [0:W-1];
  reg         nbg [0:W-1];
  reg  [34:0] a, sb;
  reg  [2:0]  s;
  reg  [34:0] n_vacc;
  reg  [2:0]  n_vsh;
  integer i;
  /* verilator lint_off WIDTHTRUNC */   // nt indexes a W-entry array (nt < W whenever it is used)
  always @(*) begin
    tk_n = 5'd0; nt = 5'd0; a = vacc; s = vsh; sb = 35'd0;
    for (i = 0; i < W; i = i + 1) begin nv[i] = 35'd0; nl[i] = 3'd0; ng[i] = 1'b0; nq[i] = 32'd0; nzf[i] = 1'b0; nbg[i] = 1'b0; end
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
            nv[nt[1:0]] = a; nl[nt[1:0]] = s + 3'd1; ng[nt[1:0]] = bq[i][7];
            nq[nt[1:0]] = a[0] ? ~a[32:1] : a[32:1]; nzf[nt[1:0]] = (a != 35'd0); nbg[nt[1:0]] = (a[34:32] != 3'd0);
            nt = nt + 5'd1; a = 35'd0; s = 3'd0;
          end else s = s + 3'd1;
        end
      end
    end
    n_vacc = a; n_vsh = s;
  end
  /* verilator lint_on WIDTHTRUNC */

  // ---------------- queue updates ----------------
  wire [4:0] bpop  = tok_mode ? tk_n : {4'd0, b_pop && b_avail};
  wire [4:0] bkeep = bcnt - bpop;
  wire [4:0] tkeep = tcnt - {2'd0, t_pop};
  integer j;
  /* verilator lint_off WIDTHEXPAND */  // integer loop index vs 5-bit occupancy counts
  always @(posedge clk) begin
    if (rst) begin
      bcnt <= 5'd0; tcnt <= 5'd0; vacc <= 35'd0; vsh <= 3'd0;
      for (j = 0; j < BQ; j = j + 1) bq[j] <= 8'd0;
      for (j = 0; j < TQ; j = j + 1) begin tq_v[j] <= 35'd0; tq_l[j] <= 3'd0; tq_g[j] <= 1'b0; tq_q[j] <= 32'd0; tq_z[j] <= 1'b0; tq_b[j] <= 1'b0; end
    end else begin
      for (j = 0; j < BQ; j = j + 1) begin
        if (j < bkeep) bq[j] <= bq[j + bpop];
        else if (push_b && (j - bkeep) < W) bq[j] <= in_data[8*(j - bkeep) +: 8];
      end
      bcnt <= bkeep + (push_b ? {2'd0, in_nbytes} : 5'd0);
      for (j = 0; j < TQ; j = j + 1) begin
        if (j < tkeep) begin
          tq_v[j] <= tq_v[j + t_pop]; tq_l[j] <= tq_l[j + t_pop]; tq_g[j] <= tq_g[j + t_pop];
          tq_q[j] <= tq_q[j + t_pop]; tq_z[j] <= tq_z[j + t_pop]; tq_b[j] <= tq_b[j + t_pop];
        end else if ((j - tkeep) < nt) begin
          tq_v[j] <= nv[j - tkeep]; tq_l[j] <= nl[j - tkeep]; tq_g[j] <= ng[j - tkeep];
          tq_q[j] <= nq[j - tkeep]; tq_z[j] <= nzf[j - tkeep]; tq_b[j] <= nbg[j - tkeep];
        end
      end
      tcnt <= tkeep + nt;
      if (tk_en) begin vacc <= n_vacc; vsh <= n_vsh; end
    end
  end
  /* verilator lint_on WIDTHEXPAND */
endmodule
`default_nettype wire

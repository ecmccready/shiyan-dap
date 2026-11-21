// TEST ONLY. Queues decoder beats (one-cycle pulses) and presents their event
// tokens, then the end-of-frame token, to scp4d_ede. `room` goes low while the
// queue is past half full so the byte stream stalls. A beat that arrives when
// the queue is already full raises `overflow` and is not stored.
`timescale 1ns/1ps
`default_nettype none
module scp4d_k1_tap #(
  parameter integer W = 4,
  parameter integer A = 11,
  parameter integer DEPTH = 32
) (
  input  wire                  clk,
  input  wire                  rst,
  input  wire [31:0]           nframes,
  input  wire [W-1:0]          d_event,
  input  wire [W*A-1:0]        d_elem,
  input  wire [W*32-1:0]       d_code,
  input  wire                  d_eof,
  output wire                  room,
  output reg                   overflow,
  output reg                   ede_valid,
  input  wire                  ede_ready,
  output reg  [A-1:0]          ede_elem,
  output reg  signed [31:0]    ede_code,
  output reg                   ede_event,
  output reg                   ede_eof,
  output reg                   ede_last
);
  reg [W-1:0] bev [0:DEPTH-1];
  reg beof [0:DEPTH-1];
  reg blast [0:DEPTH-1];
  reg [A-1:0] bel [0:DEPTH-1][0:W-1];
  reg signed [31:0] bcode [0:DEPTH-1][0:W-1];
  reg [5:0] count;
  reg [4:0] rd, wr;
  reg [31:0] frame;
  reg hold;
  reg [W-1:0] pend_ev;
  reg pend_eof, pend_last;
  reg [A-1:0] pend_elem [0:W-1];
  reg signed [31:0] pend_code [0:W-1];
  integer i;
  reg [5:0] cnt_n;
  reg [5:0] rd_n, wr_n;
  reg push;
  reg [A-1:0] sel_elem;
  reg signed [31:0] sel_code;
  reg [W-1:0] sel_clr;
  reg sel_event, sel_eof, sel_last, sel_hit;

  assign room = count < (DEPTH / 4);

  always @(*) begin
    sel_elem = {A{1'b0}};
    sel_code = 32'sd0;
    sel_clr = {W{1'b0}};
    sel_event = 1'b0;
    sel_eof = 1'b0;
    sel_last = 1'b0;
    sel_hit = 1'b0;
    for (i = 0; i < W; i = i + 1) begin
      if (!sel_hit && pend_ev[i]) begin
        sel_hit = 1'b1;
        sel_event = 1'b1;
        sel_elem = pend_elem[i];
        sel_code = pend_code[i];
        sel_clr[i] = 1'b1;
      end
    end
    if (!sel_hit && pend_eof) begin
      sel_hit = 1'b1;
      sel_eof = 1'b1;
      sel_last = pend_last;
    end
  end

  always @(posedge clk) begin
    if (rst) begin
      count <= 0;
      rd <= 0;
      wr <= 0;
      frame <= 0;
      hold <= 0;
      pend_ev <= 0;
      pend_eof <= 0;
      pend_last <= 0;
      overflow <= 0;
      ede_valid <= 0;
      ede_elem <= 0;
      ede_code <= 0;
      ede_event <= 0;
      ede_eof <= 0;
      ede_last <= 0;
      for (i = 0; i < W; i = i + 1) begin
        pend_elem[i] <= 0;
        pend_code[i] <= 0;
      end
    end else begin
      cnt_n = count;
      rd_n = rd;
      wr_n = wr;
      if (!hold && count > 0) begin
        pend_ev <= bev[rd];
        pend_eof <= beof[rd];
        pend_last <= blast[rd];
        for (i = 0; i < W; i = i + 1) begin
          pend_elem[i] <= bel[rd][i];
          pend_code[i] <= bcode[rd][i];
        end
        hold <= 1;
        rd_n = rd_n + 1;
        if (rd_n == DEPTH) rd_n = 0;
        cnt_n = cnt_n - 1;
      end else if (hold && (!ede_valid || ede_ready)) begin
        if (sel_hit) begin
          ede_valid <= 1;
          ede_elem <= sel_elem;
          ede_code <= sel_code;
          ede_event <= sel_event;
          ede_eof <= sel_eof;
          ede_last <= sel_last;
          pend_ev <= pend_ev & ~sel_clr;
          if (sel_eof) pend_eof <= 0;
        end else begin
          ede_valid <= 0;
          hold <= 0;
        end
      end
      push = ((|d_event) || d_eof);
      if (push) begin
        if (cnt_n >= DEPTH) overflow <= 1;
        else begin
          bev[wr_n] <= d_event;
          beof[wr_n] <= d_eof;
          blast[wr_n] <= d_eof && (frame + 32'd1 == nframes);
          for (i = 0; i < W; i = i + 1) begin
            bel[wr_n][i] <= d_elem[A*i +: A];
            bcode[wr_n][i] <= d_code[32*i +: 32];
          end
          if (d_eof) frame <= frame + 1;
          wr_n = wr_n + 1;
          if (wr_n == DEPTH) wr_n = 0;
          cnt_n = cnt_n + 1;
        end
      end
      rd <= rd_n;
      wr <= wr_n;
      count <= cnt_n;
    end
  end
endmodule
`default_nettype wire

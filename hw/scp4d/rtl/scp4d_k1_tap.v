// TEST ONLY. Queues decoder beats (one-cycle pulses) and presents their event
// tokens, then the end-of-frame token, to scp4d_ede. The beat queue is one
// synchronous block RAM. A head beat is sampled on one clock and used on the
// next, after the write that stored it has already committed. `room` is low
// while the queue is past one quarter full. A beat that does not fit raises
// `overflow` and is not stored.
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
  localparam integer BW = W + 2 + W * A + W * 32;
  localparam integer EV = 2;
  localparam integer EL = 2 + W;
  localparam integer CD = 2 + W + W * A;
  localparam integer S_IDLE = 0, S_LOAD = 1, S_CAP = 2, S_SEND = 3;

  (* ram_style = "block" *) reg [BW-1:0] mem [0:DEPTH-1];
  reg [BW-1:0] mem_q;
  reg [1:0] state;
  reg [5:0] count;
  reg [4:0] rd, wr;
  reg [31:0] frame;
  reg [W-1:0] pend_ev;
  reg pend_eof;
  integer i;
  reg [5:0] count_n;
  wire last_bit = d_eof && (frame + 32'd1 == nframes);
  wire [BW-1:0] beat_w = {d_code, d_elem, d_event, last_bit, d_eof};
  wire push_req = (|d_event) || d_eof;
  wire can_push = push_req && (count < DEPTH);

  reg [A-1:0] lane_elem [0:W-1];
  reg signed [31:0] lane_code [0:W-1];
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
        sel_elem = lane_elem[i];
        sel_code = lane_code[i];
        sel_clr[i] = 1'b1;
      end
    end
    if (!sel_hit && pend_eof) begin
      sel_hit = 1'b1;
      sel_eof = 1'b1;
      sel_last = mem_q[1];
    end
  end

  always @(posedge clk) begin
    if (rst) mem_q <= {BW{1'b0}};
    else begin
      if (can_push) mem[wr] <= beat_w;
      mem_q <= mem[rd];
    end
  end

  always @(posedge clk) begin
    if (rst) begin
      state <= S_IDLE;
      count <= 0;
      rd <= 0;
      wr <= 0;
      frame <= 0;
      pend_ev <= 0;
      pend_eof <= 0;
      overflow <= 0;
      ede_valid <= 0;
      ede_elem <= 0;
      ede_code <= 0;
      ede_event <= 0;
      ede_eof <= 0;
      ede_last <= 0;
      for (i = 0; i < W; i = i + 1) begin
        lane_elem[i] <= 0;
        lane_code[i] <= 0;
      end
    end else begin
      count_n = count;
      case (state)
        S_IDLE: if (count != 0) state <= S_LOAD;
        S_LOAD: state <= S_CAP;
        S_CAP: begin
          pend_ev <= mem_q[EV +: W];
          pend_eof <= mem_q[0];
          for (i = 0; i < W; i = i + 1) begin
            lane_elem[i] <= mem_q[EL + i * A +: A];
            lane_code[i] <= mem_q[CD + i * 32 +: 32];
          end
          state <= S_SEND;
        end
        S_SEND: begin
          if (!ede_valid || ede_ready) begin
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
              if (rd == DEPTH - 1) rd <= 0;
              else rd <= rd + 1;
              count_n = count_n - 1;
              state <= S_IDLE;
            end
          end
        end
        default: state <= S_IDLE;
      endcase
      if (push_req && !can_push) overflow <= 1;
      if (can_push) begin
        if (d_eof) frame <= frame + 1;
        if (wr == DEPTH - 1) wr <= 0;
        else wr <= wr + 1;
        count_n = count_n + 1;
      end
      count <= count_n;
    end
  end
endmodule
`default_nettype wire

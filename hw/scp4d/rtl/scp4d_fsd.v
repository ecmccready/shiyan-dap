// TEST ONLY. 4D-SCP v0.1.20 — full-scan decision baseline (K1-ref).
// Same compare as scp4d_ede (code > threshold). Every frame re-evaluates
// elements 0 .. D-1. No fan-out, no multiplier. Exact cycle model: runFsd
// in scripts/scp-v0120-ede-model.ts.
`timescale 1ns/1ps
`default_nettype none
module scp4d_fsd #(
  parameter integer ADDR_W = 8
) (
  input  wire                  clk,
  input  wire                  rst,
  input  wire signed [31:0]    threshold,
  input  wire [ADDR_W:0]       cfg_D,
  input  wire                  in_valid,
  output wire                  in_ready,
  input  wire [ADDR_W-1:0]     in_elem,
  input  wire signed [31:0]    in_code,
  input  wire                  in_event,
  input  wire                  in_eof,
  input  wire                  in_last,
  output reg                   out_valid,
  output reg  [ADDR_W-1:0]     out_elem,
  output reg                   out_decision,
  output reg                   out_eof,
  output reg                   done,
  output reg                   err,
  output reg  [3:0]            err_code,
  output reg  [31:0]           evals,
  output reg  [31:0]           cycles
);
  localparam integer S_CLEAR = 0, S_IDLE = 1, S_SCAN = 2, S_EOF = 3, S_ERR = 4;
  localparam integer DEPTH = 1 << ADDR_W;

  reg [2:0] state;
  reg [ADDR_W:0] clr, scan;
  reg signed [31:0] codes [0:DEPTH-1];
  reg decs [0:DEPTH-1];
  reg last_pend;
  reg signed [31:0] code_r;
  reg nd;

  assign in_ready = (state == S_IDLE);

  always @(posedge clk) begin
    if (rst) begin
      state <= S_CLEAR;
      clr <= 0;
      scan <= 0;
      last_pend <= 0;
      out_valid <= 0;
      out_eof <= 0;
      out_decision <= 0;
      done <= 0;
      err <= 0;
      err_code <= 0;
      evals <= 0;
      cycles <= 0;
    end else begin
      if (!done && !err && (state != S_IDLE || in_valid)) cycles <= cycles + 1;
      out_valid <= 0;
      out_eof <= 0;
      case (state)
        S_CLEAR: begin
          codes[clr[ADDR_W-1:0]] <= 0;
          decs[clr[ADDR_W-1:0]] <= 0;
          if (clr == cfg_D - 1) state <= S_IDLE;
          else clr <= clr + 1;
        end
        S_IDLE: begin
          if (in_valid && in_event && {1'b0, in_elem} >= cfg_D) begin
            err <= 1; err_code <= 4'd1; state <= S_ERR;
          end else if (in_valid) begin
            last_pend <= in_last;
            if (in_event) codes[in_elem] <= in_code;
            if (in_eof) begin scan <= 0; state <= S_SCAN; end
          end
        end
        S_SCAN: begin
          code_r = codes[scan[ADDR_W-1:0]];
          nd = code_r > threshold;
          if (nd != decs[scan[ADDR_W-1:0]]) begin
            out_valid <= 1;
            out_elem <= scan[ADDR_W-1:0];
            out_decision <= nd;
          end
          decs[scan[ADDR_W-1:0]] <= nd;
          evals <= evals + 1;
          if (scan == cfg_D - 1) state <= S_EOF;
          else scan <= scan + 1;
        end
        S_EOF: begin
          out_eof <= 1;
          if (last_pend) done <= 1;
          else state <= S_IDLE;
        end
        default: begin
        end
      endcase
    end
  end
endmodule
`default_nettype wire

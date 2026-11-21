// TEST ONLY. 4D-SCP v0.1.20 — event-driven decision engine (K1).
// Temporal-only by default. mode_relations marks the declared fan-out (FAN targets)
// and those cells are evaluated too. Decision is the software agent's compare:
// code > threshold, integer only. No multiply, no division, no initial block.
// Exact cycle model: scripts/scp-v0120-ede-model.ts (runEde).
`timescale 1ns/1ps
`default_nettype none
module scp4d_ede #(
  parameter integer ADDR_W = 8,
  parameter integer FAN = 4
) (
  input  wire                      clk,
  input  wire                      rst,
  input  wire                      mode_relations,
  input  wire signed [31:0]        threshold,
  input  wire [ADDR_W:0]           cfg_D,
  input  wire                      cfg_we,
  input  wire [ADDR_W-1:0]         cfg_src,
  input  wire [FAN*ADDR_W-1:0]     cfg_tgt,
  input  wire [FAN-1:0]            cfg_vld,
  input  wire                      in_valid,
  output wire                      in_ready,
  input  wire [ADDR_W-1:0]         in_elem,
  input  wire signed [31:0]        in_code,
  input  wire                      in_event,
  input  wire                      in_eof,
  input  wire                      in_last,
  output reg                       out_valid,
  output reg  [ADDR_W-1:0]         out_elem,
  output reg                       out_decision,
  output reg                       out_eof,
  output reg                       done,
  output reg                       err,
  output reg  [3:0]                err_code,
  output reg  [31:0]               evals,
  output reg  [31:0]               cycles
);
  localparam integer S_CLEAR = 0, S_IDLE = 1, S_FAN = 2, S_EVAL = 3, S_EOF = 4, S_ERR = 5;
  localparam integer DEPTH = 1 << ADDR_W;

  reg [2:0] state;
  reg [ADDR_W:0] clr;
  reg [ADDR_W:0] head, tail;
  reg [ADDR_W-1:0] queue [0:DEPTH-1];
  reg signed [31:0] codes [0:DEPTH-1];
  reg decs [0:DEPTH-1];
  reg dirty [0:DEPTH-1];
  reg [FAN*ADDR_W-1:0] fan_tgt [0:DEPTH-1];
  reg [FAN-1:0] fan_vld [0:DEPTH-1];
  reg [ADDR_W-1:0] src_r;
  reg [2:0] fan_i;
  reg eof_pend, last_pend;

  assign in_ready = (state == S_IDLE) && !cfg_we;

  reg signed [31:0] code_r;
  reg nd;
  reg [ADDR_W-1:0] tgt;
  reg [ADDR_W-1:0] qe;

  always @(posedge clk) begin
    if (rst) begin
      state <= S_CLEAR;
      clr <= 0;
      head <= 0;
      tail <= 0;
      fan_i <= 0;
      eof_pend <= 0;
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
      if (!done && !err && (state != S_IDLE || (in_valid && !cfg_we))) cycles <= cycles + 1;
      out_valid <= 0;
      out_eof <= 0;
      case (state)
        S_CLEAR: begin
          codes[clr[ADDR_W-1:0]] <= 0;
          decs[clr[ADDR_W-1:0]] <= 0;
          dirty[clr[ADDR_W-1:0]] <= 0;
          if (clr == cfg_D - 1) state <= S_IDLE;
          else clr <= clr + 1;
        end
        S_IDLE: begin
          if (cfg_we) begin
            if ({1'b0, cfg_src} >= cfg_D) begin
              err <= 1; err_code <= 4'd3; state <= S_ERR;
            end else begin
              fan_tgt[cfg_src] <= cfg_tgt;
              fan_vld[cfg_src] <= cfg_vld;
            end
          end else if (in_valid && in_event && {1'b0, in_elem} >= cfg_D) begin
            err <= 1; err_code <= 4'd1; state <= S_ERR;
          end else if (in_valid) begin
            eof_pend <= in_eof;
            last_pend <= in_last;
            src_r <= in_elem;
            fan_i <= 0;
            if (in_event) begin
              codes[in_elem] <= in_code;
              if (!dirty[in_elem]) begin
                dirty[in_elem] <= 1;
                queue[tail[ADDR_W-1:0]] <= in_elem;
                tail <= tail + 1;
              end
            end
            if (in_event && mode_relations) state <= S_FAN;
            else if (in_eof) state <= S_EVAL;
          end
        end
        S_FAN: begin
          // Constant selects: a variable bit-select on a memory word is not reliable here.
          case (fan_i)
            3'd0: begin tgt = fan_tgt[src_r][0 +: ADDR_W]; nd = fan_vld[src_r][0]; end
            3'd1: begin tgt = fan_tgt[src_r][ADDR_W +: ADDR_W]; nd = fan_vld[src_r][1]; end
            3'd2: begin tgt = fan_tgt[src_r][2*ADDR_W +: ADDR_W]; nd = fan_vld[src_r][2]; end
            default: begin tgt = fan_tgt[src_r][3*ADDR_W +: ADDR_W]; nd = fan_vld[src_r][3]; end
          endcase
          if (nd) begin
            if ({1'b0, tgt} >= cfg_D) begin
              err <= 1; err_code <= 4'd2; state <= S_ERR;
            end else if (!dirty[tgt]) begin
              dirty[tgt] <= 1;
              queue[tail[ADDR_W-1:0]] <= tgt;
              tail <= tail + 1;
            end
          end
          if (fan_i == FAN - 1) begin
            if (eof_pend) state <= S_EVAL;
            else state <= S_IDLE;
          end else fan_i <= fan_i + 1;
        end
        S_EVAL: begin
          if (head == tail) begin
            out_eof <= 1;
            head <= 0;
            tail <= 0;
            if (last_pend) done <= 1;
            else state <= S_IDLE;
          end else begin
            qe = queue[head[ADDR_W-1:0]];
            head <= head + 1;
            code_r = codes[qe];
            nd = code_r > threshold;
            if (nd != decs[qe]) begin
              out_valid <= 1;
              out_elem <= qe;
              out_decision <= nd;
            end
            decs[qe] <= nd;
            dirty[qe] <= 0;
            evals <= evals + 1;
            if (head + 1 == tail) state <= S_EOF;
          end
        end
        S_EOF: begin
          if (!done) begin
            out_eof <= 1;
            head <= 0;
            tail <= 0;
            if (last_pend) done <= 1;
            else state <= S_IDLE;
          end
        end
        default: begin
        end
      endcase
    end
  end
endmodule
`default_nettype wire

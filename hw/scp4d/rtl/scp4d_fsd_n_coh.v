// TEST ONLY. v0.1.29 full scan with a coherent-memory port.
// scp4d_fsd_n.v is not edited. N is 4 in the hybrid.
// lane_* is the row being compared. ext_* writes one decision while idle.
`timescale 1ns/1ps
`default_nettype none
module scp4d_fsd_n_coh #(
  parameter integer ADDR_W = 8,
  parameter integer N = 4
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
  output reg  [N-1:0]          out_hit,
  output reg  [N*ADDR_W-1:0]   out_elem_n,
  output reg  [N-1:0]          out_dec_n,
  output reg                   out_eof,
  output reg                   done,
  output reg                   err,
  output reg  [3:0]            err_code,
  output reg  [31:0]           evals,
  output reg  [31:0]           cycles,
  output wire                  lane_we,
  output wire [ADDR_W-1:0]     lane_row,
  output wire [N-1:0]          lane_live,
  output wire [N-1:0]          lane_dec,
  output wire [N*32-1:0]       lane_code,
  input  wire                  ext_we,
  input  wire [ADDR_W-1:0]     ext_elem,
  input  wire                  ext_dec
);
  localparam integer LN = (N == 4) ? 2 : 1;
  localparam integer ROWS = 1 << (ADDR_W - LN);
  localparam integer S_CLEAR = 0, S_IDLE = 1, S_PRIME = 2, S_RUN = 3, S_EOF = 4, S_ERR = 5;

  reg [2:0] state;
  reg [ADDR_W-LN:0] clr_row, issue, use_row;
  reg last_pend;
  wire [ADDR_W-LN:0] n_rows = (cfg_D + N - 1) >> LN;
  wire [ADDR_W-LN-1:0] in_row = in_elem[ADDR_W-1:LN];
  wire [LN-1:0] in_bank = in_elem[LN-1:0];
  wire [ADDR_W-LN-1:0] ext_row = ext_elem[ADDR_W-1:LN];
  wire [LN-1:0] ext_bank = ext_elem[LN-1:0];

  assign in_ready = (state == S_IDLE);
  assign lane_we = (state == S_RUN);
  assign lane_row = use_row[ADDR_W-1:0];

  genvar gi;
  generate
    for (gi = 0; gi < N; gi = gi + 1) begin : bk
      (* ram_style = "block" *) reg signed [31:0] code_m [0:ROWS-1];
      (* ram_style = "block" *) reg dec_m [0:ROWS-1];
      reg signed [31:0] code_q;
      reg dec_q;
      wire nd = code_q > threshold;
      wire [ADDR_W:0] elem = (use_row << LN) + gi;
      wire live = (state == S_RUN) && (elem < cfg_D);
      always @(posedge clk) begin
        if (rst) begin
          code_q <= 0;
          dec_q <= 0;
        end else begin
          if (state == S_CLEAR) code_m[clr_row[ADDR_W-LN-1:0]] <= 0;
          else if (state == S_IDLE && in_valid && in_event && in_bank == gi[LN-1:0] && {1'b0, in_elem} < cfg_D)
            code_m[in_row] <= in_code;
          code_q <= code_m[issue[ADDR_W-LN-1:0]];
          if (state == S_CLEAR) dec_m[clr_row[ADDR_W-LN-1:0]] <= 0;
          else if (live) dec_m[use_row[ADDR_W-LN-1:0]] <= nd;
          else if (state == S_IDLE && ext_we && ext_bank == gi[LN-1:0] && {1'b0, ext_elem} < cfg_D)
            dec_m[ext_row] <= ext_dec;
          dec_q <= dec_m[issue[ADDR_W-LN-1:0]];
        end
      end
      always @(posedge clk) begin
        if (rst || !live) begin
          out_hit[gi] <= 0;
        end else if (nd != dec_q) begin
          out_hit[gi] <= 1;
          out_elem_n[ADDR_W*gi +: ADDR_W] <= elem[ADDR_W-1:0];
          out_dec_n[gi] <= nd;
        end else out_hit[gi] <= 0;
      end
      assign lane_live[gi] = live;
      assign lane_dec[gi] = nd;
      assign lane_code[32*gi +: 32] = code_q;
    end
  endgenerate

  integer bi;
  reg [7:0] nlive;
  always @(*) begin
    nlive = 0;
    for (bi = 0; bi < N; bi = bi + 1)
      if ((use_row << LN) + bi < cfg_D && state == S_RUN) nlive = nlive + 1;
  end

  always @(posedge clk) begin
    if (rst) begin
      state <= S_CLEAR;
      clr_row <= 0;
      issue <= 0;
      use_row <= 0;
      last_pend <= 0;
      out_eof <= 0;
      done <= 0;
      err <= 0;
      err_code <= 0;
      evals <= 0;
      cycles <= 0;
    end else begin
      if (!done && !err && (state != S_IDLE || in_valid)) cycles <= cycles + 1;
      out_eof <= 0;
      case (state)
        S_CLEAR: begin
          if (clr_row + 1 == n_rows) state <= S_IDLE;
          else clr_row <= clr_row + 1;
        end
        S_IDLE: begin
          if (in_valid && in_event && {1'b0, in_elem} >= cfg_D) begin
            err <= 1; err_code <= 4'd1; state <= S_ERR;
          end else if (in_valid) begin
            last_pend <= in_last;
            if (in_eof) begin
              issue <= 0;
              use_row <= 0;
              state <= S_PRIME;
            end
          end
        end
        S_PRIME: begin
          issue <= 1;
          state <= S_RUN;
        end
        S_RUN: begin
          evals <= evals + nlive;
          if (use_row + 1 == n_rows) state <= S_EOF;
          else begin
            use_row <= use_row + 1;
            issue <= use_row + 2;
          end
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

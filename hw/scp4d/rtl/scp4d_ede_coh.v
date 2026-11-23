// TEST ONLY. v0.1.29 pipelined K1 with banked memories.
// scp4d_ede_pipe.v is not edited. The decision records match scp4d_ede_pipe.
// N=4 banks so a full-scan row can update code and decision in one cycle.
// upd_* is that row. ing_* writes one event code while idle.
`timescale 1ns/1ps
`default_nettype none
module scp4d_ede_coh #(
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
  output reg  [31:0]               cycles,
  input  wire                      upd_we,
  input  wire [ADDR_W-1:0]         upd_row,
  input  wire [3:0]                upd_live,
  input  wire [3:0]                upd_dec,
  input  wire [127:0]              upd_code,
  input  wire                      ing_we,
  input  wire [ADDR_W-1:0]         ing_elem,
  input  wire signed [31:0]        ing_code
);
  localparam integer LN = 2;
  localparam integer N = 4;
  localparam integer ROWS = 1 << (ADDR_W - LN);
  localparam integer S_CLEAR = 0, S_IDLE = 1, S_IN_WAIT = 2, S_IN_USE = 3;
  localparam integer S_FAN_SET = 4, S_FAN_WAIT = 5, S_FAN_USE = 6;
  localparam integer S_EV_SET = 7, S_EV_WAIT = 8, S_EV_USE = 9, S_EV_PIPE = 12, S_EOF = 10, S_ERR = 11;
  localparam integer DEPTH = 1 << ADDR_W;

  reg [3:0] state;
  reg [ADDR_W-LN:0] clr_row;
  reg [ADDR_W:0] head, tail;
  reg [ADDR_W-1:0] queue [0:DEPTH-1];
  (* ram_style = "block" *) reg [FAN*ADDR_W-1:0] fan_tgt_m [0:DEPTH-1];
  (* ram_style = "block" *) reg [FAN-1:0] fan_vld_m [0:DEPTH-1];

  reg [ADDR_W-1:0] raddr, fan_raddr;
  reg [FAN*ADDR_W-1:0] fan_tgt_q, fan_word;
  reg [FAN-1:0] fan_vld_q, fan_bits;
  reg [ADDR_W-1:0] hold_elem, hold_tgt;
  reg signed [31:0] hold_code;
  reg [2:0] fan_i;
  reg eof_pend, last_pend;
  reg [ADDR_W-1:0] tgt, qe;
  reg slot_vld;

  wire [ADDR_W-LN:0] n_rows = (cfg_D + N - 1) >> LN;
  wire [ADDR_W-LN-1:0] rd_row = raddr[ADDR_W-1:LN];
  wire [LN-1:0] rd_bank = raddr[LN-1:0];

  wire signed [31:0] bank_code [0:N-1];
  wire bank_dec [0:N-1];
  wire bank_dirty [0:N-1];
  // The value captured on the previous edge for the address in raddr.
  wire signed [31:0] code_q = bank_code[rd_bank];
  wire dec_q = bank_dec[rd_bank];
  wire dirty_q = bank_dirty[rd_bank];
  wire nd = code_q > threshold;

  assign in_ready = (state == S_IDLE) && !cfg_we;

  genvar gi;
  generate
    for (gi = 0; gi < N; gi = gi + 1) begin : bk
      (* ram_style = "block" *) reg signed [31:0] code_m [0:ROWS-1];
      (* ram_style = "block" *) reg dec_m [0:ROWS-1];
      (* ram_style = "block" *) reg dirty_m [0:ROWS-1];
      reg signed [31:0] code_r;
      reg dec_r, dirty_r;
      wire code_wr = (state == S_IN_USE) && (hold_elem[LN-1:0] == gi[LN-1:0]);
      wire ing_hit = ing_we && (state == S_IDLE) && (ing_elem[LN-1:0] == gi[LN-1:0]) && ({1'b0, ing_elem} < cfg_D);
      wire upd_hit = upd_we && upd_live[gi] && (state == S_IDLE);
      always @(posedge clk) begin
        if (rst) code_r <= 0;
        else begin
          if (state == S_CLEAR) code_m[clr_row[ADDR_W-LN-1:0]] <= 0;
          else if (upd_hit) code_m[upd_row[ADDR_W-LN-1:0]] <= upd_code[32*gi +: 32];
          else if (code_wr) code_m[hold_elem[ADDR_W-1:LN]] <= hold_code;
          else if (ing_hit) code_m[ing_elem[ADDR_W-1:LN]] <= ing_code;
          code_r <= code_m[rd_row];
        end
      end
      always @(posedge clk) begin
        if (rst) dec_r <= 0;
        else begin
          if (state == S_CLEAR) dec_m[clr_row[ADDR_W-LN-1:0]] <= 0;
          else if (upd_hit) dec_m[upd_row[ADDR_W-LN-1:0]] <= upd_dec[gi];
          else if (state == S_EV_USE && hold_elem[LN-1:0] == gi[LN-1:0]) dec_m[hold_elem[ADDR_W-1:LN]] <= nd;
          dec_r <= dec_m[rd_row];
        end
      end
      always @(posedge clk) begin
        if (rst) dirty_r <= 0;
        else begin
          if (state == S_CLEAR) dirty_m[clr_row[ADDR_W-LN-1:0]] <= 0;
          else if (state == S_IN_USE && !dirty_q && hold_elem[LN-1:0] == gi[LN-1:0]) dirty_m[hold_elem[ADDR_W-1:LN]] <= 1'b1;
          else if (state == S_FAN_USE && !dirty_q && hold_tgt[LN-1:0] == gi[LN-1:0]) dirty_m[hold_tgt[ADDR_W-1:LN]] <= 1'b1;
          else if (state == S_EV_USE && hold_elem[LN-1:0] == gi[LN-1:0]) dirty_m[hold_elem[ADDR_W-1:LN]] <= 1'b0;
          dirty_r <= dirty_m[rd_row];
        end
      end
      assign bank_code[gi] = code_r;
      assign bank_dec[gi] = dec_r;
      assign bank_dirty[gi] = dirty_r;
    end
  endgenerate

  always @(posedge clk) begin
    if (rst) begin
      fan_tgt_q <= 0;
      fan_vld_q <= 0;
    end else begin
      if (state == S_IDLE && cfg_we && {1'b0, cfg_src} < cfg_D) begin
        fan_tgt_m[cfg_src] <= cfg_tgt;
        fan_vld_m[cfg_src] <= cfg_vld;
      end
      fan_tgt_q <= fan_tgt_m[fan_raddr];
      fan_vld_q <= fan_vld_m[fan_raddr];
    end
  end

  always @(posedge clk) begin
    if (rst) begin
      state <= S_CLEAR;
      clr_row <= 0;
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
      raddr <= 0;
      fan_raddr <= 0;
    end else begin
      if (!done && !err && (state != S_IDLE || (in_valid && !cfg_we))) cycles <= cycles + 1;
      out_valid <= 0;
      out_eof <= 0;
      case (state)
        S_CLEAR: begin
          if (clr_row + 1 == n_rows) state <= S_IDLE;
          else clr_row <= clr_row + 1;
        end
        S_IDLE: begin
          if (cfg_we) begin
            if ({1'b0, cfg_src} >= cfg_D) begin
              err <= 1; err_code <= 4'd3; state <= S_ERR;
            end
          end else if (in_valid && in_event && {1'b0, in_elem} >= cfg_D) begin
            err <= 1; err_code <= 4'd1; state <= S_ERR;
          end else if (in_valid) begin
            eof_pend <= in_eof;
            last_pend <= in_last;
            if (in_event) begin
              hold_elem <= in_elem;
              hold_code <= in_code;
              raddr <= in_elem;
              fan_raddr <= in_elem;
              state <= S_IN_WAIT;
            end else if (in_eof) state <= S_EV_SET;
          end
        end
        S_IN_WAIT: state <= S_IN_USE;
        S_IN_USE: begin
          fan_word <= fan_tgt_q;
          fan_bits <= fan_vld_q;
          fan_i <= 0;
          if (!dirty_q) begin
            queue[tail[ADDR_W-1:0]] <= hold_elem;
            tail <= tail + 1;
          end
          if (mode_relations) state <= S_FAN_SET;
          else if (eof_pend) state <= S_EV_SET;
          else state <= S_IDLE;
        end
        S_FAN_SET: begin
          case (fan_i)
            3'd0: begin tgt = fan_word[0 +: ADDR_W]; slot_vld = fan_bits[0]; end
            3'd1: begin tgt = fan_word[ADDR_W +: ADDR_W]; slot_vld = fan_bits[1]; end
            3'd2: begin tgt = fan_word[2*ADDR_W +: ADDR_W]; slot_vld = fan_bits[2]; end
            default: begin tgt = fan_word[3*ADDR_W +: ADDR_W]; slot_vld = fan_bits[3]; end
          endcase
          if (slot_vld) begin
            if ({1'b0, tgt} >= cfg_D) begin
              err <= 1; err_code <= 4'd2; state <= S_ERR;
            end else begin
              hold_tgt <= tgt;
              raddr <= tgt;
              state <= S_FAN_WAIT;
            end
          end else if (fan_i == FAN - 1) begin
            if (eof_pend) state <= S_EV_SET;
            else state <= S_IDLE;
          end else fan_i <= fan_i + 1;
        end
        S_FAN_WAIT: state <= S_FAN_USE;
        S_FAN_USE: begin
          if (!dirty_q) begin
            queue[tail[ADDR_W-1:0]] <= hold_tgt;
            tail <= tail + 1;
          end
          if (fan_i == FAN - 1) begin
            if (eof_pend) state <= S_EV_SET;
            else state <= S_IDLE;
          end else begin
            fan_i <= fan_i + 1;
            state <= S_FAN_SET;
          end
        end
        S_EV_SET: begin
          if (head == tail) begin
            out_eof <= 1;
            head <= 0;
            tail <= 0;
            if (last_pend) done <= 1;
            else state <= S_IDLE;
          end else begin
            qe = queue[head[ADDR_W-1:0]];
            hold_elem <= qe;
            raddr <= qe;
            head <= head + 1;
            state <= S_EV_WAIT;
          end
        end
        S_EV_WAIT: state <= S_EV_USE;
        S_EV_USE: begin
          if (nd != dec_q) begin
            out_valid <= 1;
            out_elem <= hold_elem;
            out_decision <= nd;
          end
          evals <= evals + 1;
          if (head == tail) state <= S_EOF;
          else begin
            qe = queue[head[ADDR_W-1:0]];
            hold_elem <= qe;
            raddr <= qe;
            head <= head + 1;
            state <= S_EV_PIPE;
          end
        end
        S_EV_PIPE: state <= S_EV_USE;
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

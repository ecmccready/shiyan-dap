// TEST ONLY. v0.1.30 hybrid. Frame 0 is buffered until its eof, then
// replayed into the engine that event count selects. Later frames use the
// hold rule. scp4d_hybrid_coh.v is not edited. Power is needs real board.
`timescale 1ns/1ps
`default_nettype none
module scp4d_hybrid_ff #(
  parameter integer ADDR_W = 8,
  parameter integer FAN = 4,
  parameter integer PERCENT = 15,
  parameter integer HOLD = 1
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
  output wire                      out_valid,
  output wire [ADDR_W-1:0]         out_elem,
  output wire                      out_decision,
  output wire [3:0]                out_hit,
  output wire [4*ADDR_W-1:0]       out_elem_n,
  output wire [3:0]                out_dec_n,
  output wire                      out_eof,
  output reg                       sel_fsd,
  output wire                      done,
  output wire                      err,
  output wire [3:0]                err_code,
  output reg  [31:0]               evals,
  output reg  [31:0]               cycles
);
  localparam integer DEPTH = 1 << ADDR_W;
  localparam integer BW = ADDR_W + 35;
  localparam integer P_BUF = 0, P_PRIME = 1, P_PLAY = 2, P_RUN = 3;

  reg [1:0] phase;
  reg use_fsd, prev_hi, last_seen;
  reg [31:0] ev_count;
  reg [ADDR_W:0] bwr, brd;
  (* ram_style = "block" *) reg [BW-1:0] bufm [0:DEPTH-1];
  reg [BW-1:0] buf_q;

  wire ede_ready, fsd_ready, ede_ov, ede_od, ede_oe, fsd_oe;
  wire ede_done, fsd_done, ede_err, fsd_err;
  wire [ADDR_W-1:0] ede_oelem;
  wire [3:0] fsd_hit, fsd_dec, ede_ecode, fsd_ecode;
  wire [4*ADDR_W-1:0] fsd_elems;
  wire [31:0] ede_evals, fsd_evals, ede_cycles, fsd_cycles;
  wire lane_we;
  wire [ADDR_W-1:0] lane_row;
  wire [3:0] lane_live, lane_dec;
  wire [127:0] lane_code;

  wire engines_ready = ede_ready && fsd_ready;
  wire vis_eof = (phase == P_RUN || phase == P_PLAY) && (use_fsd ? fsd_oe : ede_oe);
  wire eng_ready = use_fsd ? fsd_ready : ede_ready;
  assign in_ready = (phase == P_BUF) ? engines_ready : ((phase == P_RUN) && !vis_eof && engines_ready);

  wire take = in_valid && in_ready && phase != P_PLAY && phase != P_PRIME;
  wire [31:0] ev_now = ev_count + ((phase == P_BUF && take && in_event) ? 32'd1 : 32'd0);
  wire buf_hi = !mode_relations && (ev_now * 32'd100 >= cfg_D * PERCENT);

  wire play = (phase == P_PLAY);
  wire play_eof = buf_q[ADDR_W+34];
  wire play_last = buf_q[ADDR_W+33];
  wire play_event = buf_q[ADDR_W+32];
  wire [ADDR_W-1:0] play_elem = buf_q[ADDR_W+31:32];
  wire signed [31:0] play_code = buf_q[31:0];
  wire play_fire = play && eng_ready;

  wire [ADDR_W-1:0] tok_elem = play ? play_elem : in_elem;
  wire signed [31:0] tok_code = play ? play_code : in_code;
  wire tok_event = play ? play_event : in_event;
  wire tok_eof_b = play ? play_eof : in_eof;
  wire tok_last = play ? play_last : in_last;
  wire tok_valid = play || (phase == P_RUN && take);

  wire host_ede = tok_valid && !use_fsd && eng_ready;
  wire host_fsd = tok_valid && use_fsd && eng_ready;
  wire this_hi = !mode_relations && (ev_count * 32'd100 >= cfg_D * PERCENT);
  wire vote_fsd = (HOLD <= 1) ? this_hi : (this_hi && prev_hi);
  wire vote_k1 = (HOLD <= 1) ? !this_hi : (!this_hi && !prev_hi);

  wire ede_iv = host_ede;
  wire fsd_iv = host_fsd || (host_ede && tok_event);
  wire fsd_iev = host_fsd ? tok_event : 1'b1;
  wire fsd_ieof = host_fsd && tok_eof_b;

  assign out_valid = (phase == P_RUN || phase == P_PLAY) && !use_fsd && ede_ov;
  assign out_eof = vis_eof;
  assign out_elem = ede_oelem;
  assign out_decision = ede_od;
  assign out_hit = ((phase == P_RUN || phase == P_PLAY) && use_fsd) ? fsd_hit : 4'b0;
  assign out_elem_n = fsd_elems;
  assign out_dec_n = fsd_dec;
  assign done = use_fsd ? fsd_done : ede_done;
  assign err = ede_err | fsd_err;
  assign err_code = ede_err ? ede_ecode : fsd_ecode;

  scp4d_ede_coh #(.ADDR_W(ADDR_W), .FAN(FAN)) ede (
    .clk(clk), .rst(rst), .mode_relations(mode_relations), .threshold(threshold), .cfg_D(cfg_D),
    .cfg_we(cfg_we), .cfg_src(cfg_src), .cfg_tgt(cfg_tgt), .cfg_vld(cfg_vld),
    .in_valid(ede_iv), .in_ready(ede_ready), .in_elem(tok_elem), .in_code(tok_code),
    .in_event(tok_event), .in_eof(host_ede && tok_eof_b), .in_last(host_ede && tok_last),
    .out_valid(ede_ov), .out_elem(ede_oelem), .out_decision(ede_od), .out_eof(ede_oe),
    .done(ede_done), .err(ede_err), .err_code(ede_ecode), .evals(ede_evals), .cycles(ede_cycles),
    .upd_we(lane_we), .upd_row(lane_row), .upd_live(lane_live), .upd_dec(lane_dec), .upd_code(lane_code),
    .ing_we(host_fsd && tok_event), .ing_elem(tok_elem), .ing_code(tok_code));
  scp4d_fsd_n_coh #(.ADDR_W(ADDR_W), .N(4)) fsd (
    .clk(clk), .rst(rst), .threshold(threshold), .cfg_D(cfg_D),
    .in_valid(fsd_iv), .in_ready(fsd_ready), .in_elem(tok_elem), .in_code(tok_code),
    .in_event(fsd_iev), .in_eof(fsd_ieof), .in_last(host_fsd && tok_last),
    .out_hit(fsd_hit), .out_elem_n(fsd_elems), .out_dec_n(fsd_dec), .out_eof(fsd_oe),
    .done(fsd_done), .err(fsd_err), .err_code(fsd_ecode), .evals(fsd_evals), .cycles(fsd_cycles),
    .lane_we(lane_we), .lane_row(lane_row), .lane_live(lane_live), .lane_dec(lane_dec), .lane_code(lane_code),
    .ext_we(!use_fsd && ede_ov), .ext_elem(ede_oelem), .ext_dec(ede_od));

  always @(posedge clk) begin
    if (rst) buf_q <= 0;
    else buf_q <= bufm[brd[ADDR_W-1:0]];
  end

  always @(posedge clk) begin
    if (rst) begin
      phase <= P_BUF;
      use_fsd <= 0;
      sel_fsd <= 0;
      prev_hi <= 0;
      last_seen <= 0;
      ev_count <= 0;
      bwr <= 0;
      brd <= 0;
      evals <= 0;
      cycles <= 0;
    end else begin
      evals <= ede_evals + fsd_evals;
      if (!done && !err && !vis_eof && (phase != P_RUN || in_valid || !engines_ready)) cycles <= cycles + 1;
      case (phase)
        P_BUF: begin
          if (take) begin
            bufm[bwr[ADDR_W-1:0]] <= {in_eof, in_last, in_event, in_elem, in_code};
            if (in_event) ev_count <= ev_count + 1;
            if (in_eof) begin
              use_fsd <= buf_hi;
              sel_fsd <= buf_hi;
              prev_hi <= buf_hi;
              bwr <= bwr + 1;
              brd <= 0;
              ev_count <= 0;
              phase <= P_PRIME;
            end else bwr <= bwr + 1;
          end
        end
        P_PRIME: phase <= P_PLAY;
        P_PLAY: begin
          if (play_fire) begin
            if (play_event) ev_count <= ev_count + 1;
            if (play_last) last_seen <= 1;
            if (play_eof) phase <= P_RUN;
            else brd <= brd + 1;
          end
        end
        default: begin
          if (take && in_eof) last_seen <= in_last;
          if (take && in_event) ev_count <= ev_count + 1;
          if (vis_eof && !err) begin
            if (!last_seen && !use_fsd && vote_fsd) begin
              use_fsd <= 1;
              sel_fsd <= 1;
            end else if (!last_seen && use_fsd && vote_k1) begin
              use_fsd <= 0;
              sel_fsd <= 0;
            end
            prev_hi <= this_hi;
            ev_count <= 0;
          end
        end
      endcase
    end
  end
endmodule
`default_nettype wire

// TEST ONLY. v0.1.29 hybrid. A switch flips the engine at the frame boundary.
// Full-scan rows update the K1 banks in the same cycle. K1 events and
// decisions update the full-scan banks. No replay and no catch-up scan.
// scp4d_hybrid_fix.v is not edited. Power is needs real board.
`timescale 1ns/1ps
`default_nettype none
module scp4d_hybrid_coh #(
  parameter integer ADDR_W = 8,
  parameter integer FAN = 4,
  parameter integer PERCENT = 15,
  parameter integer HOLD = 1,
  parameter integer START_FSD = 0
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
  reg use_fsd, prev_hi, last_seen;
  reg [31:0] ev_count;

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

  wire vis_eof = use_fsd ? fsd_oe : ede_oe;
  wire engines_ready = ede_ready && fsd_ready;
  assign in_ready = !vis_eof && engines_ready;

  wire take = in_valid && in_ready;
  wire host_ede = take && !use_fsd;
  wire host_fsd = take && use_fsd;
  wire this_hi = !mode_relations && (ev_count * 32'd100 >= cfg_D * PERCENT);
  wire vote_fsd = (HOLD <= 1) ? this_hi : (this_hi && prev_hi);
  wire vote_k1 = (HOLD <= 1) ? !this_hi : (!this_hi && !prev_hi);

  wire ede_iv = host_ede;
  wire fsd_iv = host_fsd || (host_ede && in_event);
  wire fsd_iev = host_fsd ? in_event : 1'b1;
  wire fsd_ieof = host_fsd && in_eof;
  wire [ADDR_W-1:0] fsd_ielem = in_elem;
  wire signed [31:0] fsd_icode = host_fsd ? in_code : in_code;

  assign out_valid = !use_fsd && ede_ov;
  assign out_eof = vis_eof;
  assign out_elem = ede_oelem;
  assign out_decision = ede_od;
  assign out_hit = use_fsd ? fsd_hit : 4'b0;
  assign out_elem_n = fsd_elems;
  assign out_dec_n = fsd_dec;
  assign done = use_fsd ? fsd_done : ede_done;
  assign err = ede_err | fsd_err;
  assign err_code = ede_err ? ede_ecode : fsd_ecode;

  scp4d_ede_coh #(.ADDR_W(ADDR_W), .FAN(FAN)) ede (
    .clk(clk), .rst(rst), .mode_relations(mode_relations), .threshold(threshold), .cfg_D(cfg_D),
    .cfg_we(cfg_we), .cfg_src(cfg_src), .cfg_tgt(cfg_tgt), .cfg_vld(cfg_vld),
    .in_valid(ede_iv), .in_ready(ede_ready), .in_elem(in_elem), .in_code(in_code),
    .in_event(in_event), .in_eof(host_ede && in_eof), .in_last(host_ede && in_last),
    .out_valid(ede_ov), .out_elem(ede_oelem), .out_decision(ede_od), .out_eof(ede_oe),
    .done(ede_done), .err(ede_err), .err_code(ede_ecode), .evals(ede_evals), .cycles(ede_cycles),
    .upd_we(lane_we), .upd_row(lane_row), .upd_live(lane_live), .upd_dec(lane_dec), .upd_code(lane_code),
    .ing_we(host_fsd && in_event), .ing_elem(in_elem), .ing_code(in_code));
  scp4d_fsd_n_coh #(.ADDR_W(ADDR_W), .N(4)) fsd (
    .clk(clk), .rst(rst), .threshold(threshold), .cfg_D(cfg_D),
    .in_valid(fsd_iv), .in_ready(fsd_ready), .in_elem(fsd_ielem), .in_code(fsd_icode),
    .in_event(fsd_iev), .in_eof(fsd_ieof), .in_last(host_fsd && in_last),
    .out_hit(fsd_hit), .out_elem_n(fsd_elems), .out_dec_n(fsd_dec), .out_eof(fsd_oe),
    .done(fsd_done), .err(fsd_err), .err_code(fsd_ecode), .evals(fsd_evals), .cycles(fsd_cycles),
    .lane_we(lane_we), .lane_row(lane_row), .lane_live(lane_live), .lane_dec(lane_dec), .lane_code(lane_code),
    .ext_we(!use_fsd && ede_ov), .ext_elem(ede_oelem), .ext_dec(ede_od));

  always @(posedge clk) begin
    if (rst) begin
      use_fsd <= START_FSD[0];
      sel_fsd <= START_FSD[0];
      prev_hi <= START_FSD[0];
      last_seen <= 0;
      ev_count <= 0;
      evals <= 0;
      cycles <= 0;
    end else begin
      evals <= ede_evals + fsd_evals;
      if (!done && !err && !vis_eof && (in_valid || !engines_ready)) cycles <= cycles + 1;
      if (host_ede && in_eof) last_seen <= in_last;
      if (host_fsd && in_eof) last_seen <= in_last;
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
  end
endmodule
`default_nettype wire

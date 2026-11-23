// TEST ONLY. v0.1.27 hybrid. scp4d_ede_pipe + scp4d_fsd_n (N=4).
// Frozen percent 55 from training. events * 100 >= D * 55 selects full scan.
// scp4d_hybrid.v is not edited. Power is needs real board.
`timescale 1ns/1ps
`default_nettype none
module scp4d_hybrid_n #(
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
  localparam integer H_RUN = 0, H_SYNC = 1, H_CLR = 2, H_ARM = 3, H_WAIT = 4, H_USE = 5, H_DRAIN = 6, H_REOF = 7;
  localparam integer DEPTH = 1 << ADDR_W;

  reg [2:0] phase;
  reg use_fsd, sync_arm, clr_arm, last_seen, soft_rst;
  reg [31:0] ev_count, hidden, prev_sum;
  reg [ADDR_W:0] mclr, rep_idx;
  reg mirror_clear;
  (* ram_style = "block" *) reg signed [31:0] code_m [0:DEPTH-1];
  reg signed [31:0] code_q;
  reg [ADDR_W-1:0] rep_addr;

  wire ede_ready, fsd_ready, ede_ov, ede_od, ede_oe, fsd_oe;
  wire ede_done, fsd_done, ede_err, fsd_err;
  wire [ADDR_W-1:0] ede_oelem;
  wire [3:0] fsd_hit, fsd_dec;
  wire [4*ADDR_W-1:0] fsd_elems;
  wire [3:0] ede_ecode, fsd_ecode;
  wire [31:0] ede_evals, fsd_evals, ede_cycles, fsd_cycles;
  wire ede_rst = rst | soft_rst;

  // vis_eof is declared below. The host's next token is already on the pins during
  // the visible eof cycle; in_ready stays 0 so that token waits for the next frame.
  wire vis_eof_now = (phase == H_RUN) && (use_fsd ? fsd_oe : ede_oe);
  wire host_ede = (phase == H_RUN) && !use_fsd && in_valid && !vis_eof_now && ede_ready && fsd_ready && !soft_rst;
  wire host_fsd = (phase == H_RUN) && use_fsd && in_valid && !vis_eof_now && fsd_ready;
  wire shadow = host_ede && in_event;
  wire sync_fire = (phase == H_SYNC) && !sync_arm && fsd_ready;
  wire rep_fire = (phase == H_USE) && (code_q != 0) && ede_ready;
  wire reof_fire = (phase == H_REOF) && !sync_arm && ede_ready;

  wire ede_iv = host_ede || rep_fire || reof_fire;
  wire fsd_iv = shadow || host_fsd || sync_fire;
  wire ede_iev = rep_fire ? 1'b1 : in_event;
  wire ede_ieof = reof_fire ? 1'b1 : (host_ede && in_eof);
  wire fsd_iev = shadow ? 1'b1 : (host_fsd && in_event);
  wire fsd_ieof = sync_fire ? 1'b1 : (host_fsd && in_eof);
  wire [ADDR_W-1:0] ede_ielem = rep_fire ? rep_addr : in_elem;
  wire signed [31:0] ede_icode = rep_fire ? code_q : in_code;

  assign in_ready = (phase == H_RUN) && !vis_eof_now && (use_fsd ? fsd_ready : (ede_ready && fsd_ready && !soft_rst));

  wire [31:0] ev20 = ev_count * 32'd20;
  wire [31:0] ev10 = ev_count * 32'd10;
  wire [31:0] ev100 = ev_count * 32'd100;
  wire [31:0] d7 = cfg_D * 32'd7;
  wire [31:0] d3 = cfg_D * 32'd3;
  wire next_fsd = !mode_relations && (ev_count * 32'd100 >= cfg_D * 32'd55);

  wire vis_eof = (phase == H_RUN) && (use_fsd ? fsd_oe : ede_oe);
  wire vis_valid = (phase == H_RUN) && !use_fsd && ede_ov;
  assign out_valid = vis_valid;
  assign out_eof = vis_eof;
  assign out_elem = ede_oelem;
  assign out_decision = ede_od;
  assign out_hit = (phase == H_RUN && use_fsd) ? fsd_hit : 4'b0;
  assign out_elem_n = fsd_elems;
  assign out_dec_n = fsd_dec;
  assign done = use_fsd ? fsd_done : ede_done;
  assign err = ede_err | fsd_err;
  assign err_code = ede_err ? ede_ecode : fsd_ecode;

  wire [31:0] sum = ede_evals + fsd_evals;
  wire active_idle = use_fsd ? fsd_ready : ede_ready;

  scp4d_ede_pipe #(.ADDR_W(ADDR_W), .FAN(FAN)) ede (
    .clk(clk), .rst(ede_rst), .mode_relations(mode_relations), .threshold(threshold), .cfg_D(cfg_D),
    .cfg_we(cfg_we), .cfg_src(cfg_src), .cfg_tgt(cfg_tgt), .cfg_vld(cfg_vld),
    .in_valid(ede_iv), .in_ready(ede_ready), .in_elem(ede_ielem), .in_code(ede_icode),
    .in_event(ede_iev), .in_eof(ede_ieof), .in_last(host_ede && in_last),
    .out_valid(ede_ov), .out_elem(ede_oelem), .out_decision(ede_od), .out_eof(ede_oe),
    .done(ede_done), .err(ede_err), .err_code(ede_ecode), .evals(ede_evals), .cycles(ede_cycles));
  scp4d_fsd_n #(.ADDR_W(ADDR_W), .N(4)) fsd (
    .clk(clk), .rst(rst), .threshold(threshold), .cfg_D(cfg_D),
    .in_valid(fsd_iv), .in_ready(fsd_ready), .in_elem(in_elem), .in_code(in_code),
    .in_event(fsd_iev), .in_eof(fsd_ieof), .in_last(host_fsd && in_last),
    .out_hit(fsd_hit), .out_elem_n(fsd_elems), .out_dec_n(fsd_dec), .out_eof(fsd_oe),
    .done(fsd_done), .err(fsd_err), .err_code(fsd_ecode), .evals(fsd_evals), .cycles(fsd_cycles));

  always @(posedge clk) begin
    if (rst) begin
      mclr <= 0;
      mirror_clear <= 1;
      code_q <= 0;
    end else begin
      if (mirror_clear) begin
        code_m[mclr[ADDR_W-1:0]] <= 0;
        if (mclr == cfg_D - 1) mirror_clear <= 0;
        else mclr <= mclr + 1;
      end else if ((phase == H_RUN) && in_valid && in_ready && in_event) begin
        code_m[in_elem] <= in_code;
      end
      code_q <= code_m[rep_addr];
    end
  end

  always @(posedge clk) begin
    if (rst) begin
      phase <= H_RUN;
      use_fsd <= 0;
      sel_fsd <= 0;
      sync_arm <= 0;
      clr_arm <= 0;
      last_seen <= 0;
      soft_rst <= 0;
      ev_count <= 0;
      hidden <= 0;
      prev_sum <= 0;
      evals <= 0;
      cycles <= 0;
      rep_idx <= 0;
      rep_addr <= 0;
    end else begin
      prev_sum <= sum;
      if (phase != H_RUN && sum != prev_sum) hidden <= hidden + (sum - prev_sum);
      if (phase == H_RUN) evals <= sum - hidden;
      soft_rst <= 0;
      // The engine counts the edge that raises eof. vis_eof is that edge's result, so the
      // following edge is not counted again. The clear-arm and soft-reset edges are not
      // part of the D-cycle clear.
      if (!soft_rst && !done && !err && !vis_eof && !(phase == H_SYNC && fsd_oe) && !(phase == H_REOF && ede_oe)
          && ((phase == H_RUN) ? (in_valid || !active_idle) : ((phase == H_CLR) ? (clr_arm && !ede_ready) : 1'b1)))
        cycles <= cycles + 1;
      if (host_ede && in_eof) last_seen <= in_last;
      if (host_fsd && in_eof) last_seen <= in_last;
      case (phase)
        H_RUN: begin
          if (vis_eof && !err) begin
            if (!last_seen && next_fsd != use_fsd) begin
              sync_arm <= 0;
              clr_arm <= 0;
              phase <= next_fsd ? H_SYNC : H_CLR;
            end else ev_count <= 0;
          end else if (in_valid && in_ready && in_event) ev_count <= ev_count + 1;
        end
        H_SYNC: begin
          if (sync_fire) sync_arm <= 1;
          if (fsd_oe) begin
            use_fsd <= 1;
            sel_fsd <= 1;
            ev_count <= 0;
            sync_arm <= 0;
            phase <= H_RUN;
          end
        end
        H_CLR: begin
          if (!clr_arm) begin
            soft_rst <= 1;
            clr_arm <= 1;
          end else if (!soft_rst && ede_ready) begin
            rep_idx <= 0;
            rep_addr <= 0;
            phase <= H_ARM;
          end
        end
        H_ARM: begin
          rep_addr <= rep_idx[ADDR_W-1:0];
          phase <= H_WAIT;
        end
        H_WAIT: phase <= H_USE;
        H_USE: begin
          if (code_q != 0) begin
            if (ede_ready) phase <= H_DRAIN;
          end else if (rep_idx == cfg_D - 1) begin
            sync_arm <= 0;
            phase <= H_REOF;
          end else begin
            rep_idx <= rep_idx + 1;
            phase <= H_ARM;
          end
        end
        H_DRAIN: begin
          if (ede_ready) begin
            if (rep_idx == cfg_D - 1) begin
              sync_arm <= 0;
              phase <= H_REOF;
            end else begin
              rep_idx <= rep_idx + 1;
              phase <= H_ARM;
            end
          end
        end
        H_REOF: begin
          if (reof_fire) sync_arm <= 1;
          if (ede_oe) begin
            use_fsd <= 0;
            sel_fsd <= 0;
            ev_count <= 0;
            sync_arm <= 0;
            phase <= H_RUN;
          end
        end
        default: begin
        end
      endcase
    end
  end
endmodule
`default_nettype wire

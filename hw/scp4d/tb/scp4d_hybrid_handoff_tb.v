// TEST ONLY. Synthetic fsd->K1 handoff. Not seed 9 and not seed 13.
// OLD=1 instantiates scp4d_hybrid_n. OLD=0 instantiates scp4d_hybrid_fix.
`timescale 1ns/1ps
`default_nettype none
module scp4d_hybrid_handoff_tb;
  parameter integer OLD = 0;
  parameter integer PERCENT = 55;
  parameter integer HOLD = 1;
  parameter integer START_FSD = 0;
  parameter integer ADDR_W = 8;
  localparam integer MAX_T = 512;

  reg clk = 0, rst = 1;
  reg in_valid = 0, in_event = 0, in_eof = 0, in_last = 0;
  reg [ADDR_W-1:0] in_elem = 0;
  reg signed [31:0] in_code = 0;
  reg [ADDR_W:0] cfg_D = 0;
  wire in_ready, out_valid, out_decision, out_eof, sel_fsd, done, err;
  wire [ADDR_W-1:0] out_elem;
  wire [3:0] out_hit, out_dec_n, err_code;
  wire [4*ADDR_W-1:0] out_elem_n;
  wire [31:0] evals, cycles;

  generate
    if (OLD == 1) begin : oldm
      scp4d_hybrid_n #(.ADDR_W(ADDR_W), .FAN(4)) hy (
        .clk(clk), .rst(rst), .mode_relations(1'b0), .threshold(32'sd0), .cfg_D(cfg_D),
        .cfg_we(1'b0), .cfg_src({ADDR_W{1'b0}}), .cfg_tgt({4*ADDR_W{1'b0}}), .cfg_vld(4'b0),
        .in_valid(in_valid), .in_ready(in_ready), .in_elem(in_elem), .in_code(in_code),
        .in_event(in_event), .in_eof(in_eof), .in_last(in_last),
        .out_valid(out_valid), .out_elem(out_elem), .out_decision(out_decision),
        .out_hit(out_hit), .out_elem_n(out_elem_n), .out_dec_n(out_dec_n), .out_eof(out_eof),
        .sel_fsd(sel_fsd), .done(done), .err(err), .err_code(err_code), .evals(evals), .cycles(cycles));
    end else if (OLD == 2) begin : coh
      scp4d_hybrid_coh #(.ADDR_W(ADDR_W), .FAN(4), .PERCENT(PERCENT), .HOLD(HOLD), .START_FSD(START_FSD)) hy (
        .clk(clk), .rst(rst), .mode_relations(1'b0), .threshold(32'sd0), .cfg_D(cfg_D),
        .cfg_we(1'b0), .cfg_src({ADDR_W{1'b0}}), .cfg_tgt({4*ADDR_W{1'b0}}), .cfg_vld(4'b0),
        .in_valid(in_valid), .in_ready(in_ready), .in_elem(in_elem), .in_code(in_code),
        .in_event(in_event), .in_eof(in_eof), .in_last(in_last),
        .out_valid(out_valid), .out_elem(out_elem), .out_decision(out_decision),
        .out_hit(out_hit), .out_elem_n(out_elem_n), .out_dec_n(out_dec_n), .out_eof(out_eof),
        .sel_fsd(sel_fsd), .done(done), .err(err), .err_code(err_code), .evals(evals), .cycles(cycles));
    end else begin : newm
      scp4d_hybrid_fix #(.ADDR_W(ADDR_W), .FAN(4), .PERCENT(PERCENT)) hy (
        .clk(clk), .rst(rst), .mode_relations(1'b0), .threshold(32'sd0), .cfg_D(cfg_D),
        .cfg_we(1'b0), .cfg_src({ADDR_W{1'b0}}), .cfg_tgt({4*ADDR_W{1'b0}}), .cfg_vld(4'b0),
        .in_valid(in_valid), .in_ready(in_ready), .in_elem(in_elem), .in_code(in_code),
        .in_event(in_event), .in_eof(in_eof), .in_last(in_last),
        .out_valid(out_valid), .out_elem(out_elem), .out_decision(out_decision),
        .out_hit(out_hit), .out_elem_n(out_elem_n), .out_dec_n(out_dec_n), .out_eof(out_eof),
        .sel_fsd(sel_fsd), .done(done), .err(err), .err_code(err_code), .evals(evals), .cycles(cycles));
    end
  endgenerate

  reg [ADDR_W-1:0] mem_elem [0:MAX_T-1];
  reg signed [31:0] mem_code [0:MAX_T-1];
  reg mem_event [0:MAX_T-1];
  reg mem_eof [0:MAX_T-1];
  reg mem_last [0:MAX_T-1];
  integer ntok, idx, frame, guard, fd, r;
  reg [1023:0] path;

  always #5 clk = ~clk;

  task present(input integer i);
    begin
      in_elem = mem_elem[i];
      in_code = mem_code[i];
      in_event = mem_event[i];
      in_eof = mem_eof[i];
      in_last = mem_last[i];
    end
  endtask

  initial begin
    if (!$value$plusargs("tokens=%s", path)) $fatal(1, "missing +tokens");
    if (!$value$plusargs("D=%d", r)) $fatal(1, "missing +D");
    cfg_D = r[ADDR_W:0];
    fd = $fopen(path, "r");
    if (fd == 0) $fatal(1, "open");
    ntok = 0;
    while (!$feof(fd) && ntok < MAX_T) begin
      r = $fscanf(fd, "%d %d %d %d %d\n", mem_elem[ntok], mem_code[ntok], mem_event[ntok], mem_eof[ntok], mem_last[ntok]);
      if (r == 5) ntok = ntok + 1;
    end
    $fclose(fd);
    idx = 0; frame = 0; guard = 0;
    repeat (2) @(posedge clk);
    #1 rst = 0;
    present(0);
    in_valid = 1;
  end

  always @(posedge clk) if (!rst) begin
    guard = guard + 1;
    if (in_valid && in_ready) begin
      if (idx + 1 == ntok) in_valid <= 0;
      else begin
        idx = idx + 1;
        present(idx);
      end
    end
    if (out_valid) $display("CHG %0d %0d %0d", frame, out_elem, out_decision);
    if (out_hit[0]) $display("CHG %0d %0d %0d", frame, out_elem_n[ADDR_W-1:0], out_dec_n[0]);
    if (out_hit[1]) $display("CHG %0d %0d %0d", frame, out_elem_n[2*ADDR_W-1:ADDR_W], out_dec_n[1]);
    if (out_hit[2]) $display("CHG %0d %0d %0d", frame, out_elem_n[3*ADDR_W-1:2*ADDR_W], out_dec_n[2]);
    if (out_hit[3]) $display("CHG %0d %0d %0d", frame, out_elem_n[4*ADDR_W-1:3*ADDR_W], out_dec_n[3]);
    if (out_eof) begin
      $display("FRAME %0d %0d", frame, sel_fsd);
      frame = frame + 1;
    end
    if (done || err) begin
      $display("TOTAL ok=%0d frames=%0d err=%0d cycles=%0d", (done && !err), frame, err, cycles);
      $finish;
    end
    if (guard > 200000) begin
      $display("TOTAL ok=0 frames=%0d err=%0d cycles=%0d", frame, err, cycles);
      $finish;
    end
  end
endmodule
`default_nettype wire

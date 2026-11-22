// TEST ONLY. Self-checking testbench for scp4d_hybrid.
// plusargs: +stim=<file>
// Stimulus text matches scp4d_ede_tb.v. Expected records are the shared-state
// golden for the engine chosen at each frame boundary.
`timescale 1ns/1ps
`default_nettype none
module scp4d_hybrid_tb;
  parameter integer ADDR_W = 12;
  parameter integer FAN = 4;
  localparam integer MAX_T = 131072;
  localparam integer MAX_E = 131072;
  localparam integer MAX_FAN = 4096;

  reg clk = 0, rst = 1;
  reg mode_relations = 0;
  reg signed [31:0] threshold = 0;
  reg [ADDR_W:0] cfg_D = 0;
  reg cfg_we = 0;
  reg [ADDR_W-1:0] cfg_src = 0;
  reg [FAN*ADDR_W-1:0] cfg_tgt = 0;
  reg [FAN-1:0] cfg_vld = 0;
  reg in_valid = 0;
  wire in_ready;
  reg [ADDR_W-1:0] in_elem = 0;
  reg signed [31:0] in_code = 0;
  reg in_event = 0, in_eof = 0, in_last = 0;
  wire out_valid, out_decision, out_eof, sel_fsd, done, err;
  wire [ADDR_W-1:0] out_elem;
  wire [3:0] err_code;
  wire [31:0] evals, cycles;

  scp4d_hybrid #(.ADDR_W(ADDR_W), .FAN(FAN)) dut (
    .clk(clk), .rst(rst), .mode_relations(mode_relations), .threshold(threshold), .cfg_D(cfg_D),
    .cfg_we(cfg_we), .cfg_src(cfg_src), .cfg_tgt(cfg_tgt), .cfg_vld(cfg_vld),
    .in_valid(in_valid), .in_ready(in_ready), .in_elem(in_elem), .in_code(in_code),
    .in_event(in_event), .in_eof(in_eof), .in_last(in_last),
    .out_valid(out_valid), .out_elem(out_elem), .out_decision(out_decision), .out_eof(out_eof),
    .sel_fsd(sel_fsd), .done(done), .err(err), .err_code(err_code), .evals(evals), .cycles(cycles));

  reg [1023:0] stim;
  integer fd, D, thr, rel, nfan, ntok, nexp, expect_err, i, rc;
  integer src, slot, tgt, vld, elem, code, ev, eof, last, fr, exp_e, exp_d;
  integer got, mismatches, eof_got, eof_exp, guard, pick_bad;
  reg [ADDR_W-1:0] exp_elem [0:MAX_E-1];
  reg exp_dec [0:MAX_E-1];
  integer exp_frame [0:MAX_E-1];
  integer exp_pick [0:4095];
  integer npick;
  integer tok_elem [0:MAX_T-1];
  integer tok_code [0:MAX_T-1];
  integer tok_ev [0:MAX_T-1];
  integer tok_eof [0:MAX_T-1];
  integer tok_last [0:MAX_T-1];
  integer fan_tgt_m [0:MAX_FAN-1][0:3];
  integer fan_vld_m [0:MAX_FAN-1][0:3];
  integer tptr, frame_now;
  reg drive;

  always #5 clk = ~clk;

  initial begin
    if (!$value$plusargs("stim=%s", stim)) $fatal(1, "missing +stim");
    fd = $fopen(stim, "r");
    if (fd == 0) $fatal(1, "open");
    rc = $fscanf(fd, "%d %d %d", D, thr, rel);
    rc = $fscanf(fd, "%d", nfan);
    for (i = 0; i < MAX_FAN; i = i + 1) for (slot = 0; slot < 4; slot = slot + 1) begin fan_tgt_m[i][slot] = 0; fan_vld_m[i][slot] = 0; end
    for (i = 0; i < nfan; i = i + 1) begin
      rc = $fscanf(fd, "%d %d %d %d", src, slot, tgt, vld);
      fan_tgt_m[src][slot] = tgt;
      fan_vld_m[src][slot] = vld;
    end
    rc = $fscanf(fd, "%d", ntok);
    for (i = 0; i < ntok; i = i + 1) rc = $fscanf(fd, "%d %d %d %d %d", tok_elem[i], tok_code[i], tok_ev[i], tok_eof[i], tok_last[i]);
    rc = $fscanf(fd, "%d", nexp);
    for (i = 0; i < nexp; i = i + 1) begin
      rc = $fscanf(fd, "%d %d %d", fr, exp_e, exp_d);
      exp_frame[i] = fr; exp_elem[i] = exp_e[ADDR_W-1:0]; exp_dec[i] = exp_d[0];
    end
    rc = $fscanf(fd, "%d", expect_err);
    rc = $fscanf(fd, "%d", npick);
    for (i = 0; i < npick; i = i + 1) rc = $fscanf(fd, "%d", exp_pick[i]);
    eof_exp = 0;
    for (i = 0; i < ntok; i = i + 1) if (tok_eof[i] != 0) eof_exp = eof_exp + 1;
    $fclose(fd);
    cfg_D = D[ADDR_W:0];
    threshold = thr;
    mode_relations = (rel != 0);
    got = 0; mismatches = 0; eof_got = 0; frame_now = 0; tptr = 0; drive = 0; guard = 0; pick_bad = 0;
    repeat (2) @(posedge clk);
    rst = 0;
    while (!in_ready) @(posedge clk);
    if (rel != 0) begin
      for (i = 0; i < D; i = i + 1) begin
        cfg_tgt = 0; cfg_vld = 0;
        for (slot = 0; slot < FAN; slot = slot + 1) begin
          cfg_tgt[slot*ADDR_W +: ADDR_W] = fan_tgt_m[i][slot][ADDR_W-1:0];
          cfg_vld[slot] = fan_vld_m[i][slot] != 0;
        end
        cfg_src = i[ADDR_W-1:0];
        cfg_we = 1;
        @(posedge clk);
        @(posedge clk);
      end
      cfg_we = 0;
      @(posedge clk);
    end
    drive = 1;
  end

  always @(posedge clk) if (!rst && drive && !done && !err) begin
    if (in_valid && in_ready) begin
      if (tptr + 1 < ntok) begin
        tptr <= tptr + 1;
        in_elem <= tok_elem[tptr + 1][ADDR_W-1:0];
        in_code <= tok_code[tptr + 1];
        in_event <= tok_ev[tptr + 1] != 0;
        in_eof <= tok_eof[tptr + 1] != 0;
        in_last <= tok_last[tptr + 1] != 0;
      end else in_valid <= 0;
    end else if (!in_valid && tptr < ntok && in_ready) begin
      in_valid <= 1;
      in_elem <= tok_elem[tptr][ADDR_W-1:0];
      in_code <= tok_code[tptr];
      in_event <= tok_ev[tptr] != 0;
      in_eof <= tok_eof[tptr] != 0;
      in_last <= tok_last[tptr] != 0;
    end
  end

  always @(posedge clk) if (!rst) begin
    guard = guard + 1;
    if (out_valid) begin
      if (got >= nexp || exp_elem[got] !== out_elem || exp_dec[got] !== out_decision || exp_frame[got] !== frame_now) mismatches = mismatches + 1;
      got = got + 1;
    end
    if (out_eof) begin
      if (eof_got < npick && exp_pick[eof_got] != sel_fsd) pick_bad = pick_bad + 1;
      eof_got = eof_got + 1;
      frame_now = frame_now + 1;
    end
    if (done || err || guard > 8000000) begin
      if (expect_err != 0)
        $display("RESULT ok=%0d err=%0d err_code=%0d cycles=%0d evals=%0d got=%0d mismatches=%0d eofs=%0d picks=%0d",
          (err && err_code == expect_err), err, err_code, cycles, evals, got, mismatches, eof_got, pick_bad);
      else
        $display("RESULT ok=%0d err=%0d err_code=%0d cycles=%0d evals=%0d got=%0d mismatches=%0d eofs=%0d picks=%0d",
          (done && !err && mismatches == 0 && got == nexp && eof_got == eof_exp && pick_bad == 0),
          err, err_code, cycles, evals, got, mismatches, eof_got, pick_bad);
      $finish;
    end
  end
endmodule
`default_nettype wire

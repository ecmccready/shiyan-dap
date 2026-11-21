// TEST ONLY. Self-checking testbench for scp4d_ede and scp4d_fsd.
// plusargs: +stim=<file> +dut=0|1  (0 = ede, 1 = fsd)
// Stimulus text:
//   D threshold relations
//   nfan
//   src slot tgt valid     (nfan lines)
//   ntok
//   elem code event eof last
//   nexp
//   frame elem decision
//   expect_err
`timescale 1ns/1ps
`default_nettype none
module scp4d_ede_tb;
  parameter integer ADDR_W = 8;
  parameter integer FAN = 4;
  localparam integer MAX_T = 32768;
  localparam integer MAX_E = 32768;
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
  wire in_ready_e, in_ready_f;
  reg [ADDR_W-1:0] in_elem = 0;
  reg signed [31:0] in_code = 0;
  reg in_event = 0, in_eof = 0, in_last = 0;
  wire out_valid_e, out_valid_f, out_decision_e, out_decision_f, out_eof_e, out_eof_f;
  wire [ADDR_W-1:0] out_elem_e, out_elem_f;
  wire done_e, done_f, err_e, err_f;
  wire [3:0] err_code_e, err_code_f;
  wire [31:0] evals_e, evals_f, cycles_e, cycles_f;

  scp4d_ede #(.ADDR_W(ADDR_W), .FAN(FAN)) ede (
    .clk(clk), .rst(rst), .mode_relations(mode_relations), .threshold(threshold), .cfg_D(cfg_D),
    .cfg_we(cfg_we), .cfg_src(cfg_src), .cfg_tgt(cfg_tgt), .cfg_vld(cfg_vld),
    .in_valid(in_valid), .in_ready(in_ready_e), .in_elem(in_elem), .in_code(in_code),
    .in_event(in_event), .in_eof(in_eof), .in_last(in_last),
    .out_valid(out_valid_e), .out_elem(out_elem_e), .out_decision(out_decision_e), .out_eof(out_eof_e),
    .done(done_e), .err(err_e), .err_code(err_code_e), .evals(evals_e), .cycles(cycles_e));
  scp4d_fsd #(.ADDR_W(ADDR_W)) fsd (
    .clk(clk), .rst(rst), .threshold(threshold), .cfg_D(cfg_D),
    .in_valid(in_valid), .in_ready(in_ready_f), .in_elem(in_elem), .in_code(in_code),
    .in_event(in_event), .in_eof(in_eof), .in_last(in_last),
    .out_valid(out_valid_f), .out_elem(out_elem_f), .out_decision(out_decision_f), .out_eof(out_eof_f),
    .done(done_f), .err(err_f), .err_code(err_code_f), .evals(evals_f), .cycles(cycles_f));

  reg [1023:0] stim;
  integer dut, fd, D, thr, rel, nfan, ntok, nexp, expect_err, i, rc;
  integer src, slot, tgt, vld, elem, code, ev, eof, last, fr, exp_e, exp_d;
  integer got, mismatches, eof_got, eof_exp, guard;
  reg [ADDR_W-1:0] exp_elem [0:MAX_E-1];
  reg exp_dec [0:MAX_E-1];
  integer exp_frame [0:MAX_E-1];
  integer tok_elem [0:MAX_T-1];
  integer tok_code [0:MAX_T-1];
  integer tok_ev [0:MAX_T-1];
  integer tok_eof [0:MAX_T-1];
  integer tok_last [0:MAX_T-1];
  integer fan_tgt_m [0:MAX_FAN-1][0:3];
  integer fan_vld_m [0:MAX_FAN-1][0:3];
  integer cfg_n, tptr, frame_now;
  reg drive;
  wire use_ede = (dut == 0);
  wire out_valid = use_ede ? out_valid_e : out_valid_f;
  wire out_decision = use_ede ? out_decision_e : out_decision_f;
  wire out_eof = use_ede ? out_eof_e : out_eof_f;
  wire [ADDR_W-1:0] out_elem = use_ede ? out_elem_e : out_elem_f;
  wire done = use_ede ? done_e : done_f;
  wire err = use_ede ? err_e : err_f;
  wire [3:0] err_code = use_ede ? err_code_e : err_code_f;
  wire [31:0] evals = use_ede ? evals_e : evals_f;
  wire [31:0] cycles = use_ede ? cycles_e : cycles_f;
  wire ready = use_ede ? in_ready_e : in_ready_f;

  always #5 clk = ~clk;

  initial begin
    if (!$value$plusargs("stim=%s", stim)) $fatal(1, "missing +stim");
    if (!$value$plusargs("dut=%d", dut)) dut = 0;
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
    eof_exp = 0;
    for (i = 0; i < ntok; i = i + 1) if (tok_eof[i] != 0) eof_exp = eof_exp + 1;
    $fclose(fd);
    cfg_D = D[ADDR_W:0];
    threshold = thr;
    mode_relations = (rel != 0);
    got = 0; mismatches = 0; eof_got = 0; frame_now = 0; tptr = 0; drive = 0; guard = 0;
    repeat (2) @(posedge clk);
    rst = 0;
    while (!ready) @(posedge clk);
    if (dut == 0) begin
      for (i = 0; i < D; i = i + 1) begin
        cfg_tgt = 0; cfg_vld = 0;
        for (slot = 0; slot < FAN; slot = slot + 1) begin
          cfg_tgt[slot*ADDR_W +: ADDR_W] = fan_tgt_m[i][slot][ADDR_W-1:0];
          cfg_vld[slot] = fan_vld_m[i][slot] != 0;
        end
        cfg_src = i[ADDR_W-1:0];
        cfg_we = 1;
        // Two edges so the config beat is stable when the DUT samples it.
        @(posedge clk);
        @(posedge clk);
      end
      cfg_we = 0;
      @(posedge clk);
    end
    drive = 1;
  end

  // Present the next token only after the previous one was accepted (in_valid && ready).
  always @(posedge clk) if (!rst && drive && !done && !err) begin
    if (in_valid && ready) begin
      if (tptr + 1 < ntok) begin
        tptr <= tptr + 1;
        in_elem <= tok_elem[tptr + 1][ADDR_W-1:0];
        in_code <= tok_code[tptr + 1];
        in_event <= tok_ev[tptr + 1] != 0;
        in_eof <= tok_eof[tptr + 1] != 0;
        in_last <= tok_last[tptr + 1] != 0;
      end else in_valid <= 0;
    end else if (!in_valid && tptr < ntok && ready) begin
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
    if (out_eof) begin eof_got = eof_got + 1; frame_now = frame_now + 1; end
    if (done || err || guard > 2000000) begin
      if (expect_err != 0)
        $display("RESULT dut=%0d ok=%0d err=%0d err_code=%0d cycles=%0d evals=%0d got=%0d mismatches=%0d eofs=%0d",
          dut, (err && err_code == expect_err), err, err_code, cycles, evals, got, mismatches, eof_got);
      else
        $display("RESULT dut=%0d ok=%0d err=%0d err_code=%0d cycles=%0d evals=%0d got=%0d mismatches=%0d eofs=%0d",
          dut, (done && !err && mismatches == 0 && got == nexp && eof_got == eof_exp), err, err_code, cycles, evals, got, mismatches, eof_got);
      $finish;
    end
  end
endmodule
`default_nettype wire

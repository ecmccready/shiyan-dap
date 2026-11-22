// TEST ONLY. Counts architectural memory operations by watching the FSM.
// plusargs: +stim=<file> +dut=0|1 (0 ede, 1 fsd)
// Stimulus is the scp4d_ede_tb text format, without the expected-change list.
`timescale 1ns/1ps
`default_nettype none
module scp4d_k1_traffic_tb;
  parameter integer ADDR_W = 11;
  parameter integer FAN = 4;
  localparam integer MAX_T = 131072;

  reg clk = 0, rst = 1;
  reg mode_relations = 0;
  reg signed [31:0] threshold = 0;
  reg [ADDR_W:0] cfg_D = 0;
  reg in_valid = 0;
  wire in_ready_e, in_ready_f;
  reg [ADDR_W-1:0] in_elem = 0;
  reg signed [31:0] in_code = 0;
  reg in_event = 0, in_eof = 0, in_last = 0;
  wire done_e, done_f, err_e, err_f;
  wire [31:0] evals_e, evals_f, cycles_e, cycles_f;

  scp4d_ede #(.ADDR_W(ADDR_W), .FAN(FAN)) ede (
    .clk(clk), .rst(rst), .mode_relations(mode_relations), .threshold(threshold), .cfg_D(cfg_D),
    .cfg_we(1'b0), .cfg_src({ADDR_W{1'b0}}), .cfg_tgt({FAN*ADDR_W{1'b0}}), .cfg_vld({FAN{1'b0}}),
    .in_valid(in_valid), .in_ready(in_ready_e), .in_elem(in_elem), .in_code(in_code),
    .in_event(in_event), .in_eof(in_eof), .in_last(in_last),
    .out_valid(), .out_elem(), .out_decision(), .out_eof(),
    .done(done_e), .err(err_e), .err_code(), .evals(evals_e), .cycles(cycles_e));
  scp4d_fsd #(.ADDR_W(ADDR_W)) fsd (
    .clk(clk), .rst(rst), .threshold(threshold), .cfg_D(cfg_D),
    .in_valid(in_valid), .in_ready(in_ready_f), .in_elem(in_elem), .in_code(in_code),
    .in_event(in_event), .in_eof(in_eof), .in_last(in_last),
    .out_valid(), .out_elem(), .out_decision(), .out_eof(),
    .done(done_f), .err(err_f), .err_code(), .evals(evals_f), .cycles(cycles_f));

  reg [1023:0] stim;
  integer dut, fd, D, thr, rel, nfan, ntok, i, rc, tptr, guard;
  integer elem, code, ev, eof, last;
  integer tok_elem [0:MAX_T-1];
  integer tok_code [0:MAX_T-1];
  integer tok_ev [0:MAX_T-1];
  integer tok_eof [0:MAX_T-1];
  integer tok_last [0:MAX_T-1];
  integer hist [0:15];
  integer pushes, pops;
  reg drive;
  reg [ADDR_W:0] head_d, tail_d;
  wire done = dut == 0 ? done_e : done_f;
  wire err = dut == 0 ? err_e : err_f;
  wire ready = dut == 0 ? in_ready_e : in_ready_f;
  wire [31:0] evals = dut == 0 ? evals_e : evals_f;
  wire [31:0] cycles = dut == 0 ? cycles_e : cycles_f;

  always #5 clk = ~clk;

  always @(posedge clk) if (!rst && dut == 0) begin
    if (ede.state < 16) hist[ede.state] = hist[ede.state] + 1;
    if (ede.tail == tail_d + 1) pushes = pushes + 1;
    if (ede.head == head_d + 1) pops = pops + 1;
    head_d <= ede.head;
    tail_d <= ede.tail;
  end
  always @(posedge clk) if (!rst && dut == 1) begin
    if (fsd.state < 16) hist[fsd.state] = hist[fsd.state] + 1;
  end

  initial begin
    if (!$value$plusargs("stim=%s", stim)) $fatal(1, "missing +stim");
    if (!$value$plusargs("dut=%d", dut)) dut = 0;
    fd = $fopen(stim, "r");
    rc = $fscanf(fd, "%d %d %d", D, thr, rel);
    rc = $fscanf(fd, "%d", nfan);
    rc = $fscanf(fd, "%d", ntok);
    for (i = 0; i < ntok; i = i + 1) rc = $fscanf(fd, "%d %d %d %d %d", tok_elem[i], tok_code[i], tok_ev[i], tok_eof[i], tok_last[i]);
    $fclose(fd);
    for (i = 0; i < 16; i = i + 1) hist[i] = 0;
    pushes = 0; pops = 0; head_d = 0; tail_d = 0;
    cfg_D = D[ADDR_W:0];
    threshold = thr;
    mode_relations = rel != 0;
    tptr = 0; guard = 0; drive = 0;
    repeat (2) @(posedge clk);
    #1 rst = 0;
    while (!ready) @(posedge clk);
    drive = 1;
  end

  always @(posedge clk) if (!rst && drive && !done && !err) begin
    guard = guard + 1;
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
    if (guard > 2000000) begin
      $display("RESULT ok=0");
      $finish;
    end
  end

  always @(posedge clk) if (!rst && (done || err)) begin
    $display("RESULT ok=%0d cycles=%0d evals=%0d pushes=%0d pops=%0d h0=%0d h1=%0d h2=%0d h3=%0d h4=%0d h5=%0d h6=%0d h7=%0d h8=%0d h9=%0d h10=%0d",
      done && !err, cycles, evals, pushes, pops,
      hist[0], hist[1], hist[2], hist[3], hist[4], hist[5], hist[6], hist[7], hist[8], hist[9], hist[10]);
    $finish;
  end
endmodule
`default_nettype wire

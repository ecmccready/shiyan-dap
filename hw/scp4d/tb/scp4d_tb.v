// TEST ONLY. Self-checking testbench for hw/scp4d/rtl/scp4d_tdec.v (simulation only, not synthesizable).
// Streams one S4DI v1 vector (generated .hex files, one byte / one 32-bit code per line) into the
// decoder, mirrors the decoded surface from the output tokens, compares every element of every
// frame bit-exact with the v0.1.10 model's expected codes and per-frame event counts, and counts
// clock cycles. Prints one machine-readable "RESULT ..." line.
//
// plusargs: +stream=<hex> +codes=<hex> +events=<hex> +nbytes=N +t=T +d=D
//           +expect_unsup=<err_code or 0> +expect_err=<err_code or 0> +bubbles=0|1 +id=<name>
`timescale 1ns/1ps
`default_nettype none
module scp4d_tb;
  localparam integer ADDR_W = 11;
  localparam integer MAX_BYTES = 1 << 20;
  localparam integer MAX_CODES = 1 << 20;
  localparam integer MAX_FRAMES = 1 << 12;

  reg clk = 1'b0, rst = 1'b1;
  reg [7:0] in_data = 8'd0;
  reg in_valid = 1'b0;
  wire in_ready, out_valid, out_event, out_eof, done, err, unsupported;
  wire [ADDR_W-1:0] out_elem;
  wire signed [31:0] out_code;
  wire [4:0] err_code;
  wire [31:0] hdr_T; wire [ADDR_W:0] hdr_D; wire [4:0] hdr_G; wire [1:0] hdr_pred;

  scp4d_tdec #(.ADDR_W(ADDR_W)) dut (
    .clk(clk), .rst(rst), .in_data(in_data), .in_valid(in_valid), .in_ready(in_ready),
    .out_valid(out_valid), .out_elem(out_elem), .out_code(out_code), .out_event(out_event),
    .out_eof(out_eof), .done(done), .err(err), .unsupported(unsupported), .err_code(err_code),
    .hdr_T(hdr_T), .hdr_D(hdr_D), .hdr_G(hdr_G), .hdr_pred(hdr_pred));

  reg [7:0]  stream [0:MAX_BYTES-1];
  reg [31:0] codes  [0:MAX_CODES-1];
  reg [31:0] evcnt  [0:MAX_FRAMES-1];
  reg [31:0] mirror [0:(1<<ADDR_W)-1];

  reg [1023:0] f_stream, f_codes, f_events, id;
  integer nbytes, T, D, expect_unsup, expect_err, bubbles;
  integer ptr, cyc, frame, mismatches, ev_mismatch, ev_frame, events_total, tokens, i, timeout;
  integer stall_clear, stall_sweep, stall_other, bubble_cycles, take_cycles, first_bad;
  integer reject_byte, drain_cycles, last_take_cyc;
  reg [31:0] lfsr;
  // register maxima observed (absolute values), from DUT internals
  reg [63:0] max_code, max_q, max_hold, max_pvarint, max_dq;

  function [63:0] absv(input signed [63:0] v); absv = (v < 0) ? -v : v; endfunction

  always #5 clk = ~clk;

  // byte driver: registered, presents stream[ptr]; optional pseudo-random bubbles (LFSR, fixed seed).
  // (Procedural array reads only: a continuous read of a 1M-entry array makes iverilog flatten it.)
  integer nptr;
  reg [31:0] nlfsr;

  initial begin
    if (!$value$plusargs("stream=%s", f_stream)) $fatal(1, "missing +stream");
    if (!$value$plusargs("codes=%s", f_codes)) $fatal(1, "missing +codes");
    if (!$value$plusargs("events=%s", f_events)) $fatal(1, "missing +events");
    if (!$value$plusargs("nbytes=%d", nbytes)) $fatal(1, "missing +nbytes");
    if (!$value$plusargs("t=%d", T)) $fatal(1, "missing +t");
    if (!$value$plusargs("d=%d", D)) $fatal(1, "missing +d");
    if (!$value$plusargs("expect_unsup=%d", expect_unsup)) expect_unsup = 0;
    if (!$value$plusargs("expect_err=%d", expect_err)) expect_err = 0;
    if (!$value$plusargs("bubbles=%d", bubbles)) bubbles = 0;
    if (!$value$plusargs("id=%s", id)) id = "unnamed";
    $readmemh(f_stream, stream, 0, nbytes - 1);
    if (expect_unsup == 0 && expect_err == 0) begin
      $readmemh(f_codes, codes, 0, T * D - 1);
      $readmemh(f_events, evcnt, 0, T - 1);
    end
    for (i = 0; i < (1 << ADDR_W); i = i + 1) mirror[i] = 32'd0;
    ptr = 0; cyc = 0; frame = 0; mismatches = 0; ev_mismatch = 0; ev_frame = 0; events_total = 0; tokens = 0;
    stall_clear = 0; stall_sweep = 0; stall_other = 0; bubble_cycles = 0; take_cycles = 0; first_bad = -1;
    reject_byte = -1; drain_cycles = 0; last_take_cyc = 0;
    max_code = 0; max_q = 0; max_hold = 0; max_pvarint = 0; max_dq = 0;
    lfsr = 32'hACE1_2026;
    timeout = 4 * nbytes + 4 * T * D + 20000;
    in_data = stream[0];
    repeat (2) @(posedge clk);
    #1 rst = 1'b0;
    in_valid = (nbytes > 0) && !(bubbles != 0 && lfsr[1:0] == 2'b00);
  end

  always @(posedge clk) if (!rst) begin
    cyc <= cyc + 1;
    nlfsr = {lfsr[30:0], lfsr[31] ^ lfsr[21] ^ lfsr[1] ^ lfsr[0]};
    lfsr <= nlfsr;
    nptr = (in_valid && in_ready) ? ptr + 1 : ptr;
    in_data <= (nptr < nbytes) ? stream[nptr] : 8'd0;
    in_valid <= (nptr < nbytes) && !(bubbles != 0 && nlfsr[1:0] == 2'b00);
    if (in_valid && in_ready) begin ptr <= ptr + 1; take_cycles <= take_cycles + 1; last_take_cyc <= cyc; end
    else if (ptr < nbytes && !done && !err) begin
      if (!in_valid) bubble_cycles <= bubble_cycles + 1;
      else if (dut.state == 5'd17) stall_sweep <= stall_sweep + 1;
      else if (!dut.clr_done && dut.state >= 5'd12) stall_clear <= stall_clear + 1;
      else stall_other <= stall_other + 1;
    end
    if (ptr >= nbytes && !done && !err) drain_cycles <= drain_cycles + 1;
    // register census (execute stage, when a token is live)
    if (dut.tB_valid) begin
      if (absv(dut.cn48) > max_code) max_code <= absv(dut.cn48);
      if (absv(dut.hold) > max_hold) max_hold <= absv(dut.hold);
      if (dut.tB_ev && absv(dut.tB_q) > max_q) max_q <= absv(dut.tB_q);
      if (dut.tB_ev && absv(dut.dq) > max_dq) max_dq <= absv(dut.dq);
    end
    if (in_valid && in_ready && dut.frame_state && !in_data[7] && {29'd0, dut.vfull} > max_pvarint) max_pvarint <= {29'd0, dut.vfull};
    // output side
    if (out_valid) begin
      mirror[out_elem] = out_code;
      tokens <= tokens + 1;
      if (out_event) begin ev_frame = ev_frame + 1; events_total <= events_total + 1; end
    end
    if (out_eof) begin
      for (i = 0; i < D; i = i + 1)
        if (mirror[i] !== codes[frame * D + i]) begin
          if (first_bad < 0) first_bad = frame * D + i;
          mismatches = mismatches + 1;
        end
      if (ev_frame != evcnt[frame]) ev_mismatch = ev_mismatch + 1;
      ev_frame = 0;
      frame = frame + 1;
    end
    if (err && reject_byte < 0) reject_byte = ptr;
    if (done || err || cyc > timeout) begin
      report();
      $finish;
    end
  end

  task report;
    reg ok;
    begin
      if (expect_unsup != 0 || expect_err != 0)
        ok = err && (unsupported == (expect_unsup != 0)) && (err_code == (expect_unsup != 0 ? expect_unsup : expect_err));
      else
        ok = done && !err && mismatches == 0 && ev_mismatch == 0 && frame == T && ptr == nbytes;
      $display("RESULT id=%0s ok=%0d done=%0d err=%0d unsupported=%0d err_code=%0d reject_byte=%0d bytes=%0d consumed=%0d frames=%0d T=%0d D=%0d G=%0d pred=%0d cycles=%0d take=%0d stall_clear=%0d stall_sweep=%0d stall_other=%0d bubbles=%0d drain=%0d tokens=%0d events=%0d mismatches=%0d first_bad=%0d ev_mismatch_frames=%0d max_code=%0d max_hold=%0d max_q=%0d max_dq=%0d max_pvarint=%0d timeout=%0d",
        id, ok, done, err, unsupported, err_code, reject_byte, nbytes, ptr, frame, hdr_T, hdr_D, hdr_G, hdr_pred,
        cyc + 1, take_cycles, stall_clear, stall_sweep, stall_other, bubble_cycles, drain_cycles, tokens, events_total,
        mismatches, first_bad, ev_mismatch, max_code, max_hold, max_q, max_dq, max_pvarint, (cyc > timeout));
    end
  endtask
endmodule
`default_nettype wire

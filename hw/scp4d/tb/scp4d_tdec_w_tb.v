// TEST ONLY. Self-checking testbench for hw/scp4d/rtl/scp4d_tdec_w.v (simulation only, not
// synthesizable). Streams one S4DI v1 vector (generated .hex, one byte per line) as W-byte beats
// (last beat partial), mirrors the decoded surface from the P output lanes, compares every element
// of every frame bit-exact with the v0.1.10 model's expected codes and per-frame event counts, and
// counts clock cycles (from the first cycle after reset to `done`, inclusive; as scp4d_tb.v).
// Prints one machine-readable "RESULT ..." line.
//
// plusargs: +stream=<hex> +codes=<hex> +events=<hex> +nbytes=N +t=T +d=D
//           +expect_unsup=<code or 0> +expect_err=<code or 0> +bubbles=0|1 +id=<name>
// parameter: W (iverilog -Pscp4d_tdec_w_tb.W=<1|2|4>)
`timescale 1ns/1ps
`default_nettype none
module scp4d_tdec_w_tb;
  parameter integer W = 2;
  localparam integer ADDR_W = 11;
  localparam integer MAX_BYTES = 1 << 20;
  localparam integer MAX_CODES = 1 << 20;
  localparam integer MAX_FRAMES = 1 << 12;

  reg clk = 1'b0, rst = 1'b1;
  reg [8*W-1:0] in_data = 0;
  reg [2:0] in_nbytes = 3'd0;
  reg in_valid = 1'b0;
  wire in_ready, out_eof, done, err, unsupported;
  wire [W-1:0] out_valid, out_event;
  wire [W*ADDR_W-1:0] out_elem;
  wire [W*32-1:0] out_code;
  wire [4:0] err_code;
  wire [31:0] hdr_T, consumed; wire [ADDR_W:0] hdr_D; wire [4:0] hdr_G; wire [1:0] hdr_pred;

  scp4d_tdec_w #(.W(W), .ADDR_W(ADDR_W)) dut (
    .clk(clk), .rst(rst), .in_data(in_data), .in_nbytes(in_nbytes), .in_valid(in_valid), .in_ready(in_ready),
    .out_valid(out_valid), .out_elem(out_elem), .out_code(out_code), .out_event(out_event),
    .out_eof(out_eof), .done(done), .err(err), .unsupported(unsupported), .err_code(err_code),
    .hdr_T(hdr_T), .hdr_D(hdr_D), .hdr_G(hdr_G), .hdr_pred(hdr_pred), .consumed(consumed));

  reg [7:0]  stream [0:MAX_BYTES-1];
  reg [31:0] codes  [0:MAX_CODES-1];
  reg [31:0] evcnt  [0:MAX_FRAMES-1];
  reg [31:0] mirror [0:(1<<ADDR_W)-1];

  reg [1023:0] f_stream, f_codes, f_events, id;
  integer nbytes, T, D, expect_unsup, expect_err, bubbles;
  integer ptr, cyc, frame, mismatches, ev_mismatch, ev_frame, events_total, tokens, i, l, timeout, first_bad;
  integer beats, bubble_cycles, reject_byte;
  // cycle classes
  integer c_hdr, c_clear, c_pay, c_drain, w_token, w_bank, w_frame, w_steps, w_fail, starved, steps_total, lanes_total;
  integer pops_total;
  reg [31:0] lfsr, nlfsr;
  integer nptr, nb;

  always #5 clk = ~clk;

  task load_beat(input integer p);
    integer b;
    begin
      in_data = 0;
      for (b = 0; b < W; b = b + 1) if (p + b < nbytes) in_data[8*b +: 8] = stream[p + b];
      in_nbytes = (nbytes - p >= W) ? W : (nbytes - p);
    end
  endtask

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
    ptr = 0; cyc = 0; frame = 0; mismatches = 0; ev_mismatch = 0; ev_frame = 0; events_total = 0; tokens = 0; first_bad = -1;
    beats = 0; bubble_cycles = 0; reject_byte = -1;
    c_hdr = 0; c_clear = 0; c_pay = 0; c_drain = 0; w_token = 0; w_bank = 0; w_frame = 0; w_steps = 0; w_fail = 0;
    starved = 0; steps_total = 0; lanes_total = 0; pops_total = 0;
    lfsr = 32'hACE1_2026;
    timeout = 4 * nbytes + 4 * T * D + 20000;
    load_beat(0);
    repeat (2) @(posedge clk);
    #1 rst = 1'b0;
    in_valid = (nbytes > 0) && !(bubbles != 0 && lfsr[1:0] == 2'b00);
  end

  always @(posedge clk) if (!rst) begin
    cyc <= cyc + 1;
    nlfsr = {lfsr[30:0], lfsr[31] ^ lfsr[21] ^ lfsr[1] ^ lfsr[0]};
    lfsr <= nlfsr;
    nb = (nbytes - ptr >= W) ? W : (nbytes - ptr);
    nptr = (in_valid && in_ready) ? ptr + nb : ptr;
    load_beat(nptr);
    in_valid <= (nptr < nbytes) && !(bubbles != 0 && nlfsr[1:0] == 2'b00);
    if (in_valid && in_ready) begin ptr <= nptr; beats <= beats + 1; end
    else if (ptr < nbytes && !done && !err && !in_valid) bubble_cycles <= bubble_cycles + 1;
    // cycle classes (what the decoder did this cycle)
    if (!done && !err) begin
      if (dut.state <= 5'd11) c_hdr <= c_hdr + 1;
      else if (dut.pay_state && !dut.clr_done) c_clear <= c_clear + 1;
      else if (dut.pay_state) begin
        c_pay <= c_pay + 1;
        steps_total <= steps_total + dut.c_steps;
        pops_total <= pops_total + dut.c_k;
        if (dut.c_steps == 0) starved <= starved + 1;
        case (dut.c_why)
          3'd1: w_token <= w_token + 1;
          3'd2: w_bank <= w_bank + 1;
          3'd3: w_frame <= w_frame + 1;
          3'd4: w_steps <= w_steps + 1;
          3'd5: w_fail <= w_fail + 1;
          default: ;
        endcase
      end else c_drain <= c_drain + 1;
    end
    // output side: P lanes (distinct elements), then the frame check
    for (l = 0; l < W; l = l + 1) if (out_valid[l]) begin
      mirror[out_elem[ADDR_W*l +: ADDR_W]] = out_code[32*l +: 32];
      tokens = tokens + 1; lanes_total = lanes_total + 1;
      if (out_event[l]) begin ev_frame = ev_frame + 1; events_total = events_total + 1; end
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
    if (err && reject_byte < 0) reject_byte = consumed;
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
        ok = done && !err && mismatches == 0 && ev_mismatch == 0 && frame == T && ptr == nbytes && consumed == nbytes;
      $display("RESULT id=%0s W=%0d ok=%0d done=%0d err=%0d unsupported=%0d err_code=%0d reject_byte=%0d bytes=%0d accepted=%0d consumed=%0d frames=%0d T=%0d D=%0d G=%0d pred=%0d cycles=%0d beats=%0d bubbles=%0d c_hdr=%0d c_clear=%0d c_pay=%0d c_drain=%0d starved=%0d end_token=%0d end_bank=%0d end_frame=%0d end_steps=%0d end_fail=%0d steps=%0d pops=%0d lanes=%0d events=%0d mismatches=%0d first_bad=%0d ev_mismatch_frames=%0d timeout=%0d",
        id, W, ok, done, err, unsupported, err_code, reject_byte, nbytes, ptr, consumed, frame, hdr_T, hdr_D, hdr_G, hdr_pred,
        cyc + 1, beats, bubble_cycles, c_hdr, c_clear, c_pay, c_drain, starved, w_token, w_bank, w_frame, w_steps, w_fail,
        steps_total, pops_total, lanes_total, events_total, mismatches, first_bad, ev_mismatch, (cyc > timeout));
    end
  endtask
endmodule
`default_nettype wire

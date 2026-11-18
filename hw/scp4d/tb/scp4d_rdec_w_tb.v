// TEST ONLY. Self-checking testbench for hw/scp4d/rtl/scp4d_rdec_w.v (simulation only, not
// synthesizable). As scp4d_rdec_tb.v (v0.1.12, unchanged), but the stream is driven as W-byte
// beats (last beat partial) and every cycle is classified by what the decoder did (header byte,
// clear wait, payload parse, input starvation, fan-out, settle, flush, drain), which is the
// measured Amdahl breakdown in the v0.1.13 report.
//
// plusargs: +stream=<hex> +codes=<hex> +events=<hex> +prog=<hex> +nprog=N +nbytes=N +t=T +d=D
//           +expect_unsup=<err_code or 0> +expect_err=<err_code or 0> +bubbles=0|1 +id=<name>
// parameter: W (iverilog -Pscp4d_rdec_w_tb.W=<1|2|4>)
`timescale 1ns/1ps
`default_nettype none
module scp4d_rdec_w_tb;
  parameter integer W = 2;
  localparam integer ADDR_W = 11;
  localparam integer MAX_BYTES = 1 << 20;
  localparam integer MAX_CODES = 1 << 20;
  localparam integer MAX_FRAMES = 1 << 12;
  localparam integer MAX_PROG = 1 << 13;

  reg clk = 1'b0, rst = 1'b1;
  reg [8*W-1:0] in_data = 0;
  reg [2:0] in_nbytes = 3'd0;
  reg in_valid = 1'b0;
  reg cfg_we = 1'b0; reg [1:0] cfg_sel = 2'd0; reg [15:0] cfg_addr = 16'd0; reg [47:0] cfg_data = 48'd0;
  wire in_ready, out_valid, out_event, out_eof, done, err, unsupported, hdr_rel;
  wire [ADDR_W-1:0] out_elem;
  wire signed [31:0] out_code;
  wire [4:0] err_code;
  wire [31:0] hdr_T, consumed; wire [ADDR_W:0] hdr_D; wire [4:0] hdr_G;

  scp4d_rdec_w #(.W(W), .ADDR_W(ADDR_W)) dut (
    .clk(clk), .rst(rst), .cfg_we(cfg_we), .cfg_sel(cfg_sel), .cfg_addr(cfg_addr), .cfg_data(cfg_data),
    .in_data(in_data), .in_nbytes(in_nbytes), .in_valid(in_valid), .in_ready(in_ready),
    .out_valid(out_valid), .out_elem(out_elem), .out_code(out_code), .out_event(out_event),
    .out_eof(out_eof), .done(done), .err(err), .unsupported(unsupported), .err_code(err_code),
    .hdr_T(hdr_T), .hdr_D(hdr_D), .hdr_G(hdr_G), .hdr_rel(hdr_rel), .consumed(consumed));

  reg [7:0]  stream [0:MAX_BYTES-1];
  reg [31:0] codes  [0:MAX_CODES-1];
  reg [31:0] evcnt  [0:MAX_FRAMES-1];
  reg [67:0] prog   [0:MAX_PROG-1];
  reg [31:0] mirror [0:(1<<ADDR_W)-1];

  reg [1023:0] f_stream, f_codes, f_events, f_prog, id;
  integer nbytes, T, D, nprog, expect_unsup, expect_err, bubbles;
  integer ptr, cyc, frame, mismatches, ev_mismatch, ev_frame, events_total, tokens, i, timeout;
  integer stall_clear, stall_fan, stall_flush, stall_other, bubble_cycles, take_cycles, first_bad;
  integer reject_byte, drain_cycles, last_take_cyc, fan_ops, flush_ops;
  integer beats, c_hdr, c_clear, c_parse, c_pair, c_starve, c_fan, c_settle, c_flush, c_drain, nb;
  reg [31:0] lfsr;
  reg [63:0] max_code, max_q, max_acc, max_prod, max_pvarint;

  function [63:0] absv(input signed [63:0] v); absv = (v < 0) ? -v : v; endfunction

  always #5 clk = ~clk;

  integer nptr;
  task load_beat(input integer p);
    integer b;
    begin
      in_data = 0;
      for (b = 0; b < W; b = b + 1) if (p + b < nbytes) in_data[8*b +: 8] = stream[p + b];
      in_nbytes = (nbytes - p >= W) ? W : (nbytes - p);
    end
  endtask
  reg [31:0] nlfsr;

  initial begin
    if (!$value$plusargs("stream=%s", f_stream)) $fatal(1, "missing +stream");
    if (!$value$plusargs("codes=%s", f_codes)) $fatal(1, "missing +codes");
    if (!$value$plusargs("events=%s", f_events)) $fatal(1, "missing +events");
    if (!$value$plusargs("prog=%s", f_prog)) $fatal(1, "missing +prog");
    if (!$value$plusargs("nprog=%d", nprog)) $fatal(1, "missing +nprog");
    if (!$value$plusargs("nbytes=%d", nbytes)) $fatal(1, "missing +nbytes");
    if (!$value$plusargs("t=%d", T)) $fatal(1, "missing +t");
    if (!$value$plusargs("d=%d", D)) $fatal(1, "missing +d");
    if (!$value$plusargs("expect_unsup=%d", expect_unsup)) expect_unsup = 0;
    if (!$value$plusargs("expect_err=%d", expect_err)) expect_err = 0;
    if (!$value$plusargs("bubbles=%d", bubbles)) bubbles = 0;
    if (!$value$plusargs("id=%s", id)) id = "unnamed";
    $readmemh(f_stream, stream, 0, nbytes - 1);
    $readmemh(f_prog, prog, 0, nprog - 1);
    if (expect_unsup == 0 && expect_err == 0) begin
      $readmemh(f_codes, codes, 0, T * D - 1);
      $readmemh(f_events, evcnt, 0, T - 1);
    end
    for (i = 0; i < (1 << ADDR_W); i = i + 1) mirror[i] = 32'd0;
    ptr = 0; cyc = 0; frame = 0; mismatches = 0; ev_mismatch = 0; ev_frame = 0; events_total = 0; tokens = 0;
    stall_clear = 0; stall_fan = 0; stall_flush = 0; stall_other = 0; bubble_cycles = 0; take_cycles = 0; first_bad = -1;
    reject_byte = -1; drain_cycles = 0; last_take_cyc = 0; fan_ops = 0; flush_ops = 0;
    max_code = 0; max_q = 0; max_acc = 0; max_prod = 0; max_pvarint = 0;
    beats = 0; c_hdr = 0; c_clear = 0; c_parse = 0; c_pair = 0; c_starve = 0; c_fan = 0; c_settle = 0; c_flush = 0; c_drain = 0;
    lfsr = 32'hACE1_2026;
    timeout = 4 * nbytes + 8 * T * D + 20000;
    load_beat(0);
    // relation program load (reset held high; one config write per cycle; not counted)
    for (i = 0; i < nprog; i = i + 1) begin
      @(negedge clk);
      cfg_we = 1'b1; cfg_sel = prog[i][65:64]; cfg_addr = prog[i][63:48]; cfg_data = prog[i][47:0];
    end
    @(negedge clk); cfg_we = 1'b0;
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
    if (!done && !err) begin
      if (dut.state <= 5'd11) c_hdr <= c_hdr + 1;
      else if (dut.frame_state && !dut.clr_done) c_clear <= c_clear + 1;
      else if (dut.frame_state && dut.take) begin c_parse <= c_parse + 1; if (dut.t_pop == 3'd2) c_pair <= c_pair + 1; end
      else if (dut.frame_state) c_starve <= c_starve + 1;
      else if (dut.state == 5'd17) c_fan <= c_fan + 1;
      else if (dut.state == 5'd21) c_settle <= c_settle + 1;
      else if (dut.state == 5'd22 || dut.state == 5'd23) c_flush <= c_flush + 1;
      else c_drain <= c_drain + 1;
    end
    if (ptr >= nbytes && !done && !err) drain_cycles <= drain_cycles + 1;
    // register census (execute stage, when an op is live)
    if (dut.b_nt || dut.b_tgt) begin
      if (absv(dut.cn48) > max_code) max_code <= absv(dut.cn48);
      if (absv(dut.tB_q) > max_q) max_q <= absv(dut.tB_q);
    end
    if (dut.b_fan) begin
      fan_ops <= fan_ops + 1;
      if (absv(dut.tB_pd) > max_prod) max_prod <= absv(dut.tB_pd);
      if (absv(dut.an49) > max_acc) max_acc <= absv(dut.an49);
    end
    if (dut.b_fl) begin
      flush_ops <= flush_ops + 1;
      if (absv(dut.fc33) > max_code) max_code <= absv(dut.fc33);
      if (absv(dut.acc) > max_acc) max_acc <= absv(dut.acc);
    end
    if (dut.take && {29'd0, dut.vfull} > max_pvarint) max_pvarint <= {29'd0, dut.vfull};
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
      $display("RESULT id=%0s W=%0d ok=%0d done=%0d err=%0d unsupported=%0d err_code=%0d reject_byte=%0d bytes=%0d accepted=%0d consumed=%0d frames=%0d T=%0d D=%0d G=%0d rel=%0d cycles=%0d beats=%0d bubbles=%0d c_hdr=%0d c_clear=%0d c_parse=%0d c_pair=%0d c_starve=%0d c_fan=%0d c_settle=%0d c_flush=%0d c_drain=%0d tokens=%0d events=%0d fan_ops=%0d flush_ops=%0d mismatches=%0d first_bad=%0d ev_mismatch_frames=%0d max_code=%0d max_q=%0d max_prod=%0d max_acc=%0d max_pvarint=%0d timeout=%0d",
        id, W, ok, done, err, unsupported, err_code, reject_byte, nbytes, ptr, consumed, frame, hdr_T, hdr_D, hdr_G, hdr_rel,
        cyc + 1, beats, bubble_cycles, c_hdr, c_clear, c_parse, c_pair, c_starve, c_fan, c_settle, c_flush, c_drain, tokens, events_total,
        fan_ops, flush_ops, mismatches, first_bad, ev_mismatch, max_code, max_q, max_prod, max_acc, max_pvarint, (cyc > timeout));
    end
  endtask
endmodule
`default_nettype wire

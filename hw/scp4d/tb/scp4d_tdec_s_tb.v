// TEST ONLY. Self-checking testbench for hw/scp4d/rtl/scp4d_tdec_s.v (4D-SCP v0.1.18; simulation only,
// not synthesizable). Streams one S4DI v1 vector (generated .hex, one byte per line) as W-byte beats
// (last beat partial) into THREE decoders, each with its own beat feeder (their in_ready differ):
//   p_s: scp4d_tdec_s (v0.1.18, under test)
//   p_w: scp4d_tdec_w (v0.1.13, unchanged reference)
//   p_r: scp4d_tdec_r (v0.1.17, unchanged reference)
// With +bubbles=1 the same LFSR pattern withholds beats from all three. Each port mirrors the decoded
// surface from its P output lanes and compares every element of every frame bit-exact with the
// v0.1.10 model's expected codes and per-frame event counts, and records every issued lane in a
// (frame, element) table. Output comparison (cycles may differ): after all three have finished
// (done or err) and drained, the tables of p_s and each reference must be identical (same elements
// issued in every frame, same codes, same event flags, no element issued twice in a frame), with the
// same lane / eof counts and the same done / err / err_code / unsupported. Cycles are counted for
// p_s from the first cycle after reset to `done` (inclusive; as scp4d_tb.v).
// Prints one machine-readable "RESULT ..." line.
//
// plusargs: +stream=<hex> +codes=<hex> +events=<hex> +nbytes=N +t=T +d=D
//           +expect_unsup=<code or 0> +expect_err=<code or 0> +bubbles=0|1 +id=<name>
// parameter: W (iverilog -Pscp4d_tdec_s_tb.W=<1|2|4>)
`timescale 1ns/1ps
`default_nettype none
module scp4d_tdec_s_tbp #(parameter integer W = 2, parameter integer KIND = 0, parameter integer ADDR_W = 11) (
  input wire clk, input wire rst);
  localparam integer MAX_BYTES = 1 << 20;
  localparam integer MAX_CODES = 1 << 20;
  localparam integer MAX_FRAMES = 1 << 12;
  localparam integer MAXTAB = 1 << 20;

  reg [8*W-1:0] in_data = 0;
  reg [2:0] in_nbytes = 3'd0;
  reg in_valid = 1'b0;
  wire in_ready, out_eof, done, err, unsupported;
  wire [W-1:0] out_valid, out_event;
  wire [W*ADDR_W-1:0] out_elem;
  wire [W*32-1:0] out_code;
  wire [4:0] err_code;
  wire [31:0] hdr_T, consumed; wire [ADDR_W:0] hdr_D; wire [4:0] hdr_G; wire [1:0] hdr_pred;

  // taps (p_s only)
  integer pops_total, recs_total, c_hdr, c_pay, iss_idle, cls_stall;
  generate
    if (KIND == 0) begin : gs
      scp4d_tdec_s #(.W(W), .ADDR_W(ADDR_W)) dec (
        .clk(clk), .rst(rst), .in_data(in_data), .in_nbytes(in_nbytes), .in_valid(in_valid), .in_ready(in_ready),
        .out_valid(out_valid), .out_elem(out_elem), .out_code(out_code), .out_event(out_event),
        .out_eof(out_eof), .done(done), .err(err), .unsupported(unsupported), .err_code(err_code),
        .hdr_T(hdr_T), .hdr_D(hdr_D), .hdr_G(hdr_G), .hdr_pred(hdr_pred), .consumed(consumed));
      always @(posedge clk) if (!rst && !done && !err) begin
        pops_total <= pops_total + dec.c_k;
        recs_total <= recs_total + dec.c_rn;
        if (dec.state <= 5'd11) c_hdr <= c_hdr + 1; else c_pay <= c_pay + 1;
        if (dec.i_go && dec.i_p == 3'd0) iss_idle <= iss_idle + 1;
        if (dec.cstate >= 3'd1 && dec.cstate <= 3'd3 && !dec.c_room) cls_stall <= cls_stall + 1;
      end
    end else if (KIND == 1) begin : gw
      scp4d_tdec_w #(.W(W), .ADDR_W(ADDR_W)) dec (
        .clk(clk), .rst(rst), .in_data(in_data), .in_nbytes(in_nbytes), .in_valid(in_valid), .in_ready(in_ready),
        .out_valid(out_valid), .out_elem(out_elem), .out_code(out_code), .out_event(out_event),
        .out_eof(out_eof), .done(done), .err(err), .unsupported(unsupported), .err_code(err_code),
        .hdr_T(hdr_T), .hdr_D(hdr_D), .hdr_G(hdr_G), .hdr_pred(hdr_pred), .consumed(consumed));
    end else begin : gr
      scp4d_tdec_r #(.W(W), .ADDR_W(ADDR_W)) dec (
        .clk(clk), .rst(rst), .in_data(in_data), .in_nbytes(in_nbytes), .in_valid(in_valid), .in_ready(in_ready),
        .out_valid(out_valid), .out_elem(out_elem), .out_code(out_code), .out_event(out_event),
        .out_eof(out_eof), .done(done), .err(err), .unsupported(unsupported), .err_code(err_code),
        .hdr_T(hdr_T), .hdr_D(hdr_D), .hdr_G(hdr_G), .hdr_pred(hdr_pred), .consumed(consumed));
    end
  endgenerate

  reg [7:0]  stream [0:MAX_BYTES-1];
  reg [31:0] codes  [0:MAX_CODES-1];
  reg [31:0] evcnt  [0:MAX_FRAMES-1];
  reg [31:0] mirror [0:(1<<ADDR_W)-1];
  reg [31:0] tab_code [0:MAXTAB-1];
  reg [1:0]  tab_fl   [0:MAXTAB-1];   // {issued, event}

  reg [1023:0] f_stream, f_codes, f_events;
  integer nbytes, T, D, expect_unsup, expect_err, bubbles, in_scope;
  integer ptr, cyc, frame, mismatches, ev_mismatch, ev_frame, events_total, lanes_total, eofs, dups, i, l, timeout, first_bad;
  integer beats, bubble_cycles, reject_byte, idx;
  integer fin, fin_cyc, fin_done, fin_err, fin_unsup, fin_code, fin_consumed, fin_timeout;
  reg [31:0] lfsr, nlfsr;
  integer nptr, nb;

  task load_beat(input integer p);
    integer bb;
    begin
      in_data = 0;
      for (bb = 0; bb < W; bb = bb + 1) if (p + bb < nbytes) in_data[8*bb +: 8] = stream[p + bb];
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
    in_scope = (expect_unsup == 0 && expect_err == 0);
    $readmemh(f_stream, stream, 0, nbytes - 1);
    if (in_scope) begin
      $readmemh(f_codes, codes, 0, T * D - 1);
      $readmemh(f_events, evcnt, 0, T - 1);
    end
    for (i = 0; i < (1 << ADDR_W); i = i + 1) mirror[i] = 32'd0;
    for (i = 0; i < MAXTAB && i < (T + 1) * D; i = i + 1) begin tab_fl[i] = 2'b00; tab_code[i] = 32'd0; end
    ptr = 0; cyc = 0; frame = 0; mismatches = 0; ev_mismatch = 0; ev_frame = 0; events_total = 0; lanes_total = 0;
    eofs = 0; dups = 0; first_bad = -1; beats = 0; bubble_cycles = 0; reject_byte = -1;
    fin = 0; fin_cyc = -1; fin_done = 0; fin_err = 0; fin_unsup = 0; fin_code = 0; fin_consumed = 0; fin_timeout = 0;
    pops_total = 0; recs_total = 0; c_hdr = 0; c_pay = 0; iss_idle = 0; cls_stall = 0;
    lfsr = 32'hACE1_2026;
    timeout = 4 * nbytes + 4 * T * D + 20000;
    load_beat(0);
  end
  always @(negedge rst) in_valid = (nbytes > 0) && !(bubbles != 0 && lfsr[1:0] == 2'b00);

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
    // output side: P lanes (distinct elements), then the frame check
    for (l = 0; l < W; l = l + 1) if (out_valid[l]) begin
      mirror[out_elem[ADDR_W*l +: ADDR_W]] = out_code[32*l +: 32];
      idx = frame * D + out_elem[ADDR_W*l +: ADDR_W];
      if (idx < MAXTAB) begin
        if (tab_fl[idx][1]) dups = dups + 1;
        tab_fl[idx] = {1'b1, out_event[l]};
        tab_code[idx] = out_code[32*l +: 32];
      end
      lanes_total = lanes_total + 1;
      if (out_event[l]) begin ev_frame = ev_frame + 1; events_total = events_total + 1; end
    end
    if (out_eof) begin
      if (in_scope) begin
        for (i = 0; i < D; i = i + 1)
          if (mirror[i] !== codes[frame * D + i]) begin
            if (first_bad < 0) first_bad = frame * D + i;
            mismatches = mismatches + 1;
          end
        if (ev_frame != evcnt[frame]) ev_mismatch = ev_mismatch + 1;
      end
      ev_frame = 0; eofs = eofs + 1;
      frame = frame + 1;
    end
    if (err && reject_byte < 0) reject_byte = consumed;
    if (fin == 0 && (done || err || cyc > timeout)) begin
      fin = 1; fin_cyc = cyc + 1; fin_done = done; fin_err = err; fin_unsup = unsupported; fin_code = err_code;
      fin_consumed = consumed; fin_timeout = (cyc > timeout);
    end
  end
endmodule

module scp4d_tdec_s_tb;
  parameter integer W = 2;
  localparam integer ADDR_W = 11;
  reg clk = 1'b0, rst = 1'b1;
  always #5 clk = ~clk;
  scp4d_tdec_s_tbp #(.W(W), .KIND(0), .ADDR_W(ADDR_W)) p_s (.clk(clk), .rst(rst));
  scp4d_tdec_s_tbp #(.W(W), .KIND(1), .ADDR_W(ADDR_W)) p_w (.clk(clk), .rst(rst));
  scp4d_tdec_s_tbp #(.W(W), .KIND(2), .ADDR_W(ADDR_W)) p_r (.clk(clk), .rst(rst));
  reg [1023:0] id;
  integer drain, diff_w, diff_r, n, i;
  initial begin
    if (!$value$plusargs("id=%s", id)) id = "unnamed";
    drain = 0;
    repeat (2) @(posedge clk);
    #1 rst = 1'b0;
  end

  task cmp_tables(output integer d, input integer which);
    integer k, fw, ld, ed, dd, fe, fd, fc, fu, fq;
    begin
      d = 0;
      fw = p_s.frame; ld = 0;
      if (which == 1) begin
        if (p_w.frame > fw) fw = p_w.frame;
        n = (fw + 1) * p_s.D; if (n > (1 << 20)) n = 1 << 20;
        for (k = 0; k < n; k = k + 1)
          if (p_s.tab_fl[k] !== p_w.tab_fl[k] || (p_s.tab_fl[k][1] && p_s.tab_code[k] !== p_w.tab_code[k])) d = d + 1;
        if (p_s.lanes_total != p_w.lanes_total || p_s.eofs != p_w.eofs || p_s.dups != 0 || p_w.dups != 0) d = d + 1;
        if (p_s.fin_done != p_w.fin_done || p_s.fin_err != p_w.fin_err || p_s.fin_unsup != p_w.fin_unsup || p_s.fin_code != p_w.fin_code) d = d + 1;
      end else begin
        if (p_r.frame > fw) fw = p_r.frame;
        n = (fw + 1) * p_s.D; if (n > (1 << 20)) n = 1 << 20;
        for (k = 0; k < n; k = k + 1)
          if (p_s.tab_fl[k] !== p_r.tab_fl[k] || (p_s.tab_fl[k][1] && p_s.tab_code[k] !== p_r.tab_code[k])) d = d + 1;
        if (p_s.lanes_total != p_r.lanes_total || p_s.eofs != p_r.eofs || p_s.dups != 0 || p_r.dups != 0) d = d + 1;
        if (p_s.fin_done != p_r.fin_done || p_s.fin_err != p_r.fin_err || p_s.fin_unsup != p_r.fin_unsup || p_s.fin_code != p_r.fin_code) d = d + 1;
      end
    end
  endtask

  always @(posedge clk) if (!rst && p_s.fin != 0 && p_w.fin != 0 && p_r.fin != 0) begin
    drain = drain + 1;
    if (drain == 6) begin
      cmp_tables(diff_w, 1);
      cmp_tables(diff_r, 2);
      report();
      $finish;
    end
  end

  task report;
    reg ok;
    begin
      if (p_s.expect_unsup != 0 || p_s.expect_err != 0)
        ok = p_s.fin_err && (p_s.fin_unsup == (p_s.expect_unsup != 0)) && (p_s.fin_code == (p_s.expect_unsup != 0 ? p_s.expect_unsup : p_s.expect_err));
      else
        ok = p_s.fin_done && !p_s.fin_err && p_s.mismatches == 0 && p_s.ev_mismatch == 0 && p_s.frame == p_s.T && p_s.ptr == p_s.nbytes && p_s.fin_consumed == p_s.nbytes;
      ok = ok && (diff_w == 0) && (diff_r == 0) && !p_s.fin_timeout;
      $display("RESULT id=%0s W=%0d ok=%0d done=%0d err=%0d unsupported=%0d err_code=%0d reject_byte=%0d bytes=%0d accepted=%0d consumed=%0d frames=%0d T=%0d D=%0d cycles=%0d ref_w_cycles=%0d ref_r_cycles=%0d beats=%0d bubbles=%0d c_hdr=%0d c_pay=%0d pops=%0d records=%0d iss_idle=%0d cls_stall=%0d lanes=%0d events=%0d eofs=%0d dups=%0d mismatches=%0d first_bad=%0d ev_mismatch_frames=%0d out_diff_w=%0d out_diff_r=%0d timeout=%0d",
        id, W, ok, p_s.fin_done, p_s.fin_err, p_s.fin_unsup, p_s.fin_code, p_s.reject_byte, p_s.nbytes, p_s.ptr, p_s.fin_consumed, p_s.frame, p_s.T, p_s.D,
        p_s.fin_cyc, p_w.fin_cyc, p_r.fin_cyc, p_s.beats, p_s.bubble_cycles, p_s.c_hdr, p_s.c_pay, p_s.pops_total, p_s.recs_total, p_s.iss_idle, p_s.cls_stall,
        p_s.lanes_total, p_s.events_total, p_s.eofs, p_s.dups, p_s.mismatches, p_s.first_bad, p_s.ev_mismatch, diff_w, diff_r, p_s.fin_timeout);
    end
  endtask
endmodule
`default_nettype wire

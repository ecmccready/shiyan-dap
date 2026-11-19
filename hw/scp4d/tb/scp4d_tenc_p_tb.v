// TEST ONLY. Self-checking testbench for hw/scp4d/rtl/scp4d_tenc_p.v (v0.1.15) (simulation only, not
// synthesizable). Feeds one configuration + host header segments + integer input codes (generated
// .hex files) and compares every output byte with the v0.1.10 model's stream (byte-exact). Counts
// clock cycles from the `start` cycle (cycle 1) to the cycle `done` is observed, inclusive.
// Prints one machine-readable "RESULT ..." line.
//
// plusargs: +stream=<hex> +nbytes=N +codes=<hex> +hdr=<hex> +nhdr=N +nx +ny +nz +c +t +g +pred
//           +tmlen=N +gaps=0|1 (pseudo-random input / header gaps) +bp=0|1 (pseudo-random output
//           backpressure) +expect_err=<code or 0> +beat_err=0|1 +hdr_zero=0|1 +id=<name>
// parameters: W, L (iverilog -Pscp4d_tenc_p_tb.W=<1|2|4> -Pscp4d_tenc_p_tb.L=<1|2|4|8>)
`timescale 1ns/1ps
`default_nettype none
module scp4d_tenc_p_tb;
  parameter integer W = 2;
  parameter integer L = 2;
  localparam integer ADDR_W = 11;
  localparam integer MAX_BYTES = 1 << 20;
  localparam integer MAX_CODES = 1 << 20;
  localparam integer MAX_HDR = 1 << 16;

  reg clk = 1'b0, rst = 1'b1, start = 1'b0;
  reg [15:0] nx, ny, nz, nc; reg [31:0] T, tmlen; reg [4:0] G; reg [1:0] pred;
  reg [8*W-1:0] hdr_data = 0; reg [2:0] hdr_nbytes = 0; reg hdr_valid = 1'b0; wire hdr_ready;
  reg [32*L-1:0] in_x = 0; reg [3:0] in_n = 0; reg in_valid = 1'b0; wire in_ready;
  wire [8*W-1:0] out_data; wire [2:0] out_nbytes; wire out_valid; reg out_ready = 1'b1;
  wire busy, done, err; wire [4:0] err_code; wire [ADDR_W:0] cfg_D;

  scp4d_tenc_p #(.W(W), .L(L), .ADDR_W(ADDR_W)) dut (
    .clk(clk), .rst(rst), .start(start), .cfg_nx(nx), .cfg_ny(ny), .cfg_nz(nz), .cfg_c(nc), .cfg_T(T), .cfg_G(G), .cfg_pred(pred), .cfg_tm_len(tmlen),
    .hdr_data(hdr_data), .hdr_nbytes(hdr_nbytes), .hdr_valid(hdr_valid), .hdr_ready(hdr_ready),
    .in_x(in_x), .in_n(in_n), .in_valid(in_valid), .in_ready(in_ready),
    .out_data(out_data), .out_nbytes(out_nbytes), .out_valid(out_valid), .out_ready(out_ready),
    .busy(busy), .done(done), .err(err), .err_code(err_code), .cfg_D(cfg_D));

  reg [7:0]  stream [0:MAX_BYTES-1];
  reg [31:0] codes  [0:MAX_CODES-1];
  reg [7:0]  hdr    [0:MAX_HDR-1];
  reg [1023:0] f_stream, f_codes, f_hdr, id;
  integer nbytes, nhdr, neps, D, ng, lastn, expect_err, gaps, bp, beat_err, hdr_zero, t32;
  integer cyc, timeout, optr, mism, first_bad, hptr, ct, cg, beats_in, beats_out, in_stall, out_stall, in_gap, bp_cyc;
  integer first_in, last_in, first_out, last_out, b, nh, nhn, hseg_end;
  reg [31:0] lfsr, nlfsr;
  reg in_done;
  reg [32*L-1:0] tx; reg [3:0] tn; reg [8*W-1:0] th; reg [2:0] thn;

  always #5 clk = ~clk;

  function integer lanes(input integer g);
    begin lanes = (g == ng - 1) ? lastn : L; end
  endfunction
  task load_in(input integer t, input integer g);
    integer k;
    begin
      tx = 0;
      for (k = 0; k < L; k = k + 1) if (k < lanes(g)) tx[32*k +: 32] = codes[t * D + g * L + k];
      tn = lanes(g) + ((beat_err != 0) ? 1 : 0);
    end
  endtask
  // host header beat: never straddles the eps / times-meta boundary (neps)
  function integer hbeat(input integer p);
    integer e;
    begin
      e = (p < neps) ? neps : nhdr;
      hbeat = (e - p >= W) ? W : (e - p);
    end
  endfunction
  task load_hdr(input integer p);
    integer k;
    begin
      th = 0;
      for (k = 0; k < W; k = k + 1) if (k < hbeat(p)) th[8*k +: 8] = hdr[p + k];
      thn = (hdr_zero != 0) ? 0 : hbeat(p);
    end
  endtask

  initial begin
    if (!$value$plusargs("stream=%s", f_stream)) $fatal(1, "missing +stream");
    if (!$value$plusargs("nbytes=%d", nbytes)) $fatal(1, "missing +nbytes");
    if (!$value$plusargs("codes=%s", f_codes)) $fatal(1, "missing +codes");
    if (!$value$plusargs("hdr=%s", f_hdr)) $fatal(1, "missing +hdr");
    if (!$value$plusargs("nhdr=%d", nhdr)) $fatal(1, "missing +nhdr");
    if (!$value$plusargs("nx=%d", t32)) $fatal(1, "missing +nx"); nx = t32;
    if (!$value$plusargs("ny=%d", t32)) $fatal(1, "missing +ny"); ny = t32;
    if (!$value$plusargs("nz=%d", t32)) $fatal(1, "missing +nz"); nz = t32;
    if (!$value$plusargs("c=%d", t32)) $fatal(1, "missing +c"); nc = t32;
    if (!$value$plusargs("t=%d", t32)) $fatal(1, "missing +t"); T = t32;
    if (!$value$plusargs("g=%d", t32)) $fatal(1, "missing +g"); G = t32;
    if (!$value$plusargs("pred=%d", t32)) $fatal(1, "missing +pred"); pred = t32;
    if (!$value$plusargs("tmlen=%d", t32)) $fatal(1, "missing +tmlen"); tmlen = t32;
    if (!$value$plusargs("expect_err=%d", expect_err)) expect_err = 0;
    if (!$value$plusargs("gaps=%d", gaps)) gaps = 0;
    if (!$value$plusargs("bp=%d", bp)) bp = 0;
    if (!$value$plusargs("beat_err=%d", beat_err)) beat_err = 0;
    if (!$value$plusargs("hdr_zero=%d", hdr_zero)) hdr_zero = 0;
    if (!$value$plusargs("id=%s", id)) id = "unnamed";
    D = nx * ny * nz * nc; neps = 8 * nc;
    ng = (D + L - 1) / L; lastn = D - (ng - 1) * L;
    if (nbytes > 0) $readmemh(f_stream, stream, 0, nbytes - 1);
    if (nhdr > 0) $readmemh(f_hdr, hdr, 0, nhdr - 1);
    if (D > 0 && D <= (1 << ADDR_W) && T > 0) $readmemh(f_codes, codes, 0, T * D - 1);
    cyc = 0; optr = 0; mism = 0; first_bad = -1; hptr = 0; ct = 0; cg = 0; beats_in = 0; beats_out = 0;
    in_stall = 0; out_stall = 0; in_gap = 0; bp_cyc = 0; first_in = -1; last_in = -1; first_out = -1; last_out = -1;
    in_done = (D <= 0 || D > (1 << ADDR_W) || T == 0);
    lfsr = 32'h5EED_2026;
    timeout = 8 * nbytes + 4 * T * D + 4 * nhdr + 20000;
    repeat (2) @(posedge clk);
    #1 rst = 1'b0; start = 1'b1;
    if (!in_done) begin load_in(0, 0); in_x = tx; in_n = tn; end
    load_hdr(0); hdr_data = th; hdr_nbytes = thn;
    in_valid = !in_done;
    hdr_valid = (nhdr > 0);
  end

  always @(posedge clk) if (!rst) begin
    cyc = cyc + 1;
    start <= 1'b0;
    nlfsr = {lfsr[30:0], lfsr[31] ^ lfsr[21] ^ lfsr[1] ^ lfsr[0]};
    lfsr <= nlfsr;
    // output side (sampled at this edge)
    if (out_valid && out_ready) begin
      for (b = 0; b < W; b = b + 1) if (b < out_nbytes) begin
        if (optr >= nbytes || out_data[8*b +: 8] !== stream[optr]) begin mism = mism + 1; if (first_bad < 0) first_bad = optr; end
        optr = optr + 1;
      end
      beats_out = beats_out + 1;
      if (first_out < 0) first_out = cyc;
      last_out = cyc;
    end
    if (out_valid && !out_ready) bp_cyc = bp_cyc + 1;
    out_ready <= (bp == 0) || (nlfsr[3:2] != 2'b00);
    // code input
    if (in_valid && in_ready) begin
      beats_in = beats_in + 1;
      if (first_in < 0) first_in = cyc;
      last_in = cyc;
      if (cg == ng - 1) begin cg = 0; ct = ct + 1; end else cg = cg + 1;
      if (ct == T) in_done = 1'b1;
    end else if (in_valid && !in_ready) in_stall = in_stall + 1;
    else if (!in_valid && !in_done) in_gap = in_gap + 1;
    if (!in_done) begin load_in(ct, cg); in_x <= tx; in_n <= tn; end
    in_valid <= !in_done && !(gaps != 0 && nlfsr[1:0] == 2'b00);
    // host header input
    if (hdr_valid && hdr_ready) hptr = hptr + hbeat(hptr);
    load_hdr(hptr); hdr_data <= th; hdr_nbytes <= thn;
    hdr_valid <= (hptr < nhdr) && !(gaps != 0 && nlfsr[5:4] == 2'b00);
    if (done || err || cyc > timeout) begin
      report();
      $finish;
    end
  end

  task report;
    reg ok;
    begin
      if (expect_err != 0) ok = err && (err_code == expect_err) && !done;
      else ok = done && !err && mism == 0 && optr == nbytes && in_done && hptr == nhdr;
      $display("RESULT id=%0s W=%0d L=%0d ok=%0d done=%0d err=%0d err_code=%0d bytes=%0d out_bytes=%0d mismatches=%0d first_bad=%0d T=%0d D=%0d G=%0d pred=%0d cycles=%0d beats_in=%0d beats_out=%0d first_in=%0d last_in=%0d first_out=%0d last_out=%0d in_stall=%0d in_gap=%0d bp_cycles=%0d hdr_bytes=%0d timeout=%0d",
        id, W, L, ok, done, err, err_code, nbytes, optr, mism, first_bad, T, D, G, pred, cyc, beats_in, beats_out, first_in, last_in, first_out, last_out, in_stall, in_gap, bp_cyc, hptr, (cyc > timeout));
    end
  endtask
endmodule
`default_nettype wire

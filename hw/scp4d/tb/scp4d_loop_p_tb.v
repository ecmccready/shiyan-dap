// TEST ONLY. Closed-loop testbench (simulation only, not synthesizable) for v0.1.15: integer codes ->
// scp4d_tenc_p (W bytes / cycle out, L codes / cycle in) -> S4DI v1 byte stream ->
// scp4d_tdec_w (v0.1.13, unchanged, same W) -> decoded codes. The two run concurrently (the decoder
// consumes the encoder's beats as they are produced, with the decoder's in_ready as the encoder's
// out_ready). Checks every decoded element of every frame bit-exact against the v0.1.10 model's
// reconstruction AND within the deadband of the input code (|x - c| <= 2^G - 1), and measures:
// cycles from `start` (cycle 1) to the decoder's `done` (inclusive), the encoder's last output
// beat, per-frame latency (last input beat of frame t accepted -> decoder's end of frame t).
// Prints one machine-readable "RESULT ..." line.
//
// plusargs: as scp4d_tenc_p_tb.v (+stream +nbytes +codes +hdr +nhdr +nx +ny +nz +c +t +g +pred
//           +tmlen +gaps +id) plus +dec=<hex: expected decoded codes, frame-major>
// parameters: W (encoder output = decoder input bytes / cycle: 2 or 4), L (encoder lanes).
`timescale 1ns/1ps
`default_nettype none
module scp4d_loop_p_tb;
  parameter integer W = 2;
  parameter integer L = 2;
  localparam integer ADDR_W = 11;
  localparam integer MAX_BYTES = 1 << 20;
  localparam integer MAX_CODES = 1 << 20;
  localparam integer MAX_HDR = 1 << 16;
  localparam integer MAX_FRAMES = 1 << 12;

  reg clk = 1'b0, rst = 1'b1, start = 1'b0;
  reg [15:0] nx, ny, nz, nc; reg [31:0] T, tmlen; reg [4:0] G; reg [1:0] pred;
  reg [8*W-1:0] hdr_data = 0; reg [2:0] hdr_nbytes = 0; reg hdr_valid = 1'b0; wire hdr_ready;
  reg [32*L-1:0] in_x = 0; reg [3:0] in_n = 0; reg in_valid = 1'b0; wire in_ready;
  wire [8*W-1:0] s_data; wire [2:0] s_nbytes; wire s_valid, s_ready;
  wire e_busy, e_done, e_err; wire [4:0] e_code; wire [ADDR_W:0] e_D;
  wire [W-1:0] d_valid, d_event; wire [W*ADDR_W-1:0] d_elem; wire [W*32-1:0] d_code;
  wire d_eof, d_done, d_err, d_unsup; wire [4:0] d_code_err; wire [31:0] d_T, d_cons; wire [ADDR_W:0] d_D; wire [4:0] d_G; wire [1:0] d_pred;

  scp4d_tenc_p #(.W(W), .L(L), .ADDR_W(ADDR_W)) enc (
    .clk(clk), .rst(rst), .start(start), .cfg_nx(nx), .cfg_ny(ny), .cfg_nz(nz), .cfg_c(nc), .cfg_T(T), .cfg_G(G), .cfg_pred(pred), .cfg_tm_len(tmlen),
    .hdr_data(hdr_data), .hdr_nbytes(hdr_nbytes), .hdr_valid(hdr_valid), .hdr_ready(hdr_ready),
    .in_x(in_x), .in_n(in_n), .in_valid(in_valid), .in_ready(in_ready),
    .out_data(s_data), .out_nbytes(s_nbytes), .out_valid(s_valid), .out_ready(s_ready),
    .busy(e_busy), .done(e_done), .err(e_err), .err_code(e_code), .cfg_D(e_D));
  scp4d_tdec_w #(.W(W), .ADDR_W(ADDR_W)) dec (
    .clk(clk), .rst(rst), .in_data(s_data), .in_nbytes(s_nbytes), .in_valid(s_valid), .in_ready(s_ready),
    .out_valid(d_valid), .out_elem(d_elem), .out_code(d_code), .out_event(d_event),
    .out_eof(d_eof), .done(d_done), .err(d_err), .unsupported(d_unsup), .err_code(d_code_err),
    .hdr_T(d_T), .hdr_D(d_D), .hdr_G(d_G), .hdr_pred(d_pred), .consumed(d_cons));

  reg [7:0]  hdr    [0:MAX_HDR-1];
  reg [31:0] codes  [0:MAX_CODES-1];
  reg [31:0] dexp   [0:MAX_CODES-1];
  reg [31:0] mirror [0:(1<<ADDR_W)-1];
  reg [31:0] in_last [0:MAX_FRAMES-1];
  reg [1023:0] f_codes, f_hdr, f_dec, id;
  integer nbytes, nhdr, neps, D, ng, lastn, gaps, t32;
  integer cyc, timeout, hptr, ct, cg, frame, mism, eps_bad, first_bad, i, l, sbytes;
  integer first_in, last_in, first_dec, enc_last_out, enc_done_cyc, lat_max, lat_sum, lat_min, lat;
  reg signed [32:0] dlt;
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
      tn = lanes(g);
    end
  endtask
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
      thn = hbeat(p);
    end
  endtask

  initial begin
    if (!$value$plusargs("nbytes=%d", nbytes)) $fatal(1, "missing +nbytes");
    if (!$value$plusargs("codes=%s", f_codes)) $fatal(1, "missing +codes");
    if (!$value$plusargs("dec=%s", f_dec)) $fatal(1, "missing +dec");
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
    if (!$value$plusargs("gaps=%d", gaps)) gaps = 0;
    if (!$value$plusargs("id=%s", id)) id = "unnamed";
    D = nx * ny * nz * nc; neps = 8 * nc;
    ng = (D + L - 1) / L; lastn = D - (ng - 1) * L;
    $readmemh(f_hdr, hdr, 0, nhdr - 1);
    $readmemh(f_codes, codes, 0, T * D - 1);
    $readmemh(f_dec, dexp, 0, T * D - 1);
    for (i = 0; i < (1 << ADDR_W); i = i + 1) mirror[i] = 32'd0;
    cyc = 0; hptr = 0; ct = 0; cg = 0; frame = 0; mism = 0; eps_bad = 0; first_bad = -1; sbytes = 0;
    first_in = -1; last_in = -1; first_dec = -1; enc_last_out = -1; enc_done_cyc = -1; lat_max = 0; lat_sum = 0; lat_min = 1 << 30;
    in_done = 1'b0;
    lfsr = 32'h5EED_2026;
    timeout = 8 * nbytes + 4 * T * D + 4 * nhdr + 20000;
    repeat (2) @(posedge clk);
    #1 rst = 1'b0; start = 1'b1;
    load_in(0, 0); in_x = tx; in_n = tn;
    load_hdr(0); hdr_data = th; hdr_nbytes = thn;
    in_valid = 1'b1;
    hdr_valid = (nhdr > 0);
  end

  always @(posedge clk) if (!rst) begin
    cyc = cyc + 1;
    start <= 1'b0;
    nlfsr = {lfsr[30:0], lfsr[31] ^ lfsr[21] ^ lfsr[1] ^ lfsr[0]};
    lfsr <= nlfsr;
    if (s_valid && s_ready) begin sbytes = sbytes + s_nbytes; enc_last_out = cyc; end
    if (e_done && enc_done_cyc < 0) enc_done_cyc = cyc;
    // encoder input
    if (in_valid && in_ready) begin
      if (first_in < 0) first_in = cyc;
      last_in = cyc;
      if (cg == ng - 1) begin in_last[ct] = cyc; cg = 0; ct = ct + 1; end else cg = cg + 1;
      if (ct == T) in_done = 1'b1;
    end
    if (!in_done) begin load_in(ct, cg); in_x <= tx; in_n <= tn; end
    in_valid <= !in_done && !(gaps != 0 && nlfsr[1:0] == 2'b00);
    if (hdr_valid && hdr_ready) hptr = hptr + hbeat(hptr);
    load_hdr(hptr); hdr_data <= th; hdr_nbytes <= thn;
    hdr_valid <= (hptr < nhdr) && !(gaps != 0 && nlfsr[5:4] == 2'b00);
    // decoder output
    for (l = 0; l < W; l = l + 1) if (d_valid[l]) begin
      mirror[d_elem[ADDR_W*l +: ADDR_W]] = d_code[32*l +: 32];
      if (first_dec < 0) first_dec = cyc;
    end
    if (d_eof) begin
      for (i = 0; i < D; i = i + 1) begin
        if (mirror[i] !== dexp[frame * D + i]) begin if (first_bad < 0) first_bad = frame * D + i; mism = mism + 1; end
        dlt = $signed({codes[frame * D + i][31], codes[frame * D + i]}) - $signed({mirror[i][31], mirror[i]});
        if (dlt > ((33'sd1 <<< G) - 1) || dlt < -((33'sd1 <<< G) - 1)) eps_bad = eps_bad + 1;
      end
      lat = cyc - in_last[frame];
      if (lat > lat_max) lat_max = lat;
      if (lat < lat_min) lat_min = lat;
      lat_sum = lat_sum + lat;
      frame = frame + 1;
    end
    if (d_done || d_err || e_err || cyc > timeout) begin
      report();
      $finish;
    end
  end

  task report;
    reg ok;
    begin
      ok = d_done && !d_err && !e_err && e_done && mism == 0 && eps_bad == 0 && frame == T && sbytes == nbytes && d_cons == nbytes;
      $display("RESULT id=%0s W=%0d L=%0d ok=%0d enc_done=%0d enc_err=%0d enc_err_code=%0d dec_done=%0d dec_err=%0d dec_err_code=%0d bytes=%0d stream_bytes=%0d consumed=%0d frames=%0d T=%0d D=%0d cycles=%0d enc_done_cycle=%0d enc_last_out=%0d first_in=%0d last_in=%0d first_dec=%0d lat_min=%0d lat_max=%0d lat_sum=%0d mismatches=%0d first_bad=%0d eps_violations=%0d timeout=%0d",
        id, W, L, ok, e_done, e_err, e_code, d_done, d_err, d_code_err, nbytes, sbytes, d_cons, frame, T, D, cyc, enc_done_cyc, enc_last_out, first_in, last_in, first_dec, lat_min, lat_max, lat_sum, mism, first_bad, eps_bad, (cyc > timeout));
    end
  endtask
endmodule
`default_nettype wire

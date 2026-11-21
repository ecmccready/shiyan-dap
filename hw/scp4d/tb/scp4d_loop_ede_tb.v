// TEST ONLY. Closed loop tenc_q → tdec_s → scp4d_ede (temporal-only; tdec_s rejects relations).
// W=2, L=2. Decoder outputs are captured and then accepted by scp4d_ede one token per
// ready cycle. Decision-change records are compared with +chg. Codes are compared with +dec.
// plusargs: the scp4d_loop_s_tb set, plus +thr= +chg= +nexp is inside the chg file.
`timescale 1ns/1ps
`default_nettype none
module scp4d_loop_ede_tb;
  parameter integer W = 2;
  parameter integer L = 2;
  localparam integer ADDR_W = 11;
  localparam integer MAX_BYTES = 1 << 16;
  localparam integer MAX_CODES = 1 << 16;
  localparam integer MAX_HDR = 1 << 12;
  localparam integer MAX_CAP = 1 << 12;

  reg clk = 0, rst = 1, start = 0;
  reg [15:0] nx, ny, nz, nc;
  reg [31:0] T, tmlen;
  reg [4:0] G;
  reg [1:0] pred;
  reg [8*W-1:0] hdr_data = 0;
  reg [2:0] hdr_nbytes = 0;
  reg hdr_valid = 0;
  wire hdr_ready;
  reg [32*L-1:0] in_x = 0;
  reg [3:0] in_n = 0;
  reg in_valid = 0;
  wire in_ready;
  wire [8*W-1:0] s_data;
  wire [2:0] s_nbytes;
  wire s_valid, s_ready;
  wire e_busy, e_done, e_err;
  wire [4:0] e_code;
  wire [ADDR_W:0] e_D;
  wire [W-1:0] d_valid, d_event;
  wire [W*ADDR_W-1:0] d_elem;
  wire [W*32-1:0] d_code;
  wire d_eof, d_done, d_err, d_unsup;
  wire [4:0] d_code_err;
  wire [31:0] d_T, d_cons;
  wire [ADDR_W:0] d_D;
  wire [4:0] d_G;
  wire [1:0] d_pred;

  scp4d_tenc_q #(.W(W), .L(L), .ADDR_W(ADDR_W)) enc (
    .clk(clk), .rst(rst), .start(start), .cfg_nx(nx), .cfg_ny(ny), .cfg_nz(nz), .cfg_c(nc), .cfg_T(T), .cfg_G(G), .cfg_pred(pred), .cfg_tm_len(tmlen),
    .hdr_data(hdr_data), .hdr_nbytes(hdr_nbytes), .hdr_valid(hdr_valid), .hdr_ready(hdr_ready),
    .in_x(in_x), .in_n(in_n), .in_valid(in_valid), .in_ready(in_ready),
    .out_data(s_data), .out_nbytes(s_nbytes), .out_valid(s_valid), .out_ready(s_ready),
    .busy(e_busy), .done(e_done), .err(e_err), .err_code(e_code), .cfg_D(e_D));
  scp4d_tdec_s #(.W(W), .ADDR_W(ADDR_W)) dec (
    .clk(clk), .rst(rst), .in_data(s_data), .in_nbytes(s_nbytes), .in_valid(s_valid), .in_ready(s_ready),
    .out_valid(d_valid), .out_elem(d_elem), .out_code(d_code), .out_event(d_event),
    .out_eof(d_eof), .done(d_done), .err(d_err), .unsupported(d_unsup), .err_code(d_code_err),
    .hdr_T(d_T), .hdr_D(d_D), .hdr_G(d_G), .hdr_pred(d_pred), .consumed(d_cons));

  reg signed [31:0] thr = 0;
  reg [ADDR_W:0] ede_D = 0;
  reg cap_feed = 0;
  reg ede_valid = 0;
  reg [ADDR_W-1:0] ede_elem = 0;
  reg signed [31:0] ede_code = 0;
  reg ede_event = 0, ede_eof = 0, ede_last = 0;
  wire ede_ready, ede_out_valid, ede_out_dec, ede_out_eof, ede_done, ede_err;
  wire [ADDR_W-1:0] ede_out_elem;
  wire [3:0] ede_err_code;
  wire [31:0] ede_evals, ede_cycles;
  wire [7:0] ede_out_elem_w;
  scp4d_ede #(.ADDR_W(8), .FAN(4)) ede (
    .clk(clk), .rst(rst), .mode_relations(1'b0), .threshold(thr), .cfg_D(ede_D[8:0]),
    .cfg_we(1'b0), .cfg_src(8'd0), .cfg_tgt(32'd0), .cfg_vld(4'b0),
    .in_valid(ede_valid), .in_ready(ede_ready), .in_elem(ede_elem[7:0]), .in_code(ede_code),
    .in_event(ede_event), .in_eof(ede_eof), .in_last(ede_last),
    .out_valid(ede_out_valid), .out_elem(ede_out_elem_w), .out_decision(ede_out_dec), .out_eof(ede_out_eof),
    .done(ede_done), .err(ede_err), .err_code(ede_err_code), .evals(ede_evals), .cycles(ede_cycles));

  reg [7:0] hdr [0:MAX_HDR-1];
  reg [31:0] codes [0:MAX_CODES-1];
  reg [31:0] dexp [0:MAX_CODES-1];
  reg [31:0] mirror [0:(1<<ADDR_W)-1];
  reg [ADDR_W-1:0] cap_elem [0:MAX_CAP-1];
  reg signed [31:0] cap_code [0:MAX_CAP-1];
  reg cap_ev [0:MAX_CAP-1];
  reg cap_eof [0:MAX_CAP-1];
  reg cap_last [0:MAX_CAP-1];
  reg [ADDR_W-1:0] exp_elem [0:MAX_CAP-1];
  reg exp_dec [0:MAX_CAP-1];
  integer exp_frame [0:MAX_CAP-1];
  reg [1023:0] f_codes, f_hdr, f_dec, f_chg, id;
  integer nbytes, nhdr, neps, D, ng, lastn, t32, nexp, cap_n, feed_i, got, mism_e, frame_e, guard;
  integer cyc, timeout, hptr, ct, cg, frame, mism, i, l, sbytes;
  reg in_done, phase2;
  reg [32*L-1:0] tx;
  reg [3:0] tn;
  reg [8*W-1:0] th;
  reg [2:0] thn;

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
    if (!$value$plusargs("chg=%s", f_chg)) $fatal(1, "missing +chg");
    if (!$value$plusargs("nhdr=%d", nhdr)) $fatal(1, "missing +nhdr");
    if (!$value$plusargs("nx=%d", t32)) $fatal(1, "missing +nx"); nx = t32;
    if (!$value$plusargs("ny=%d", t32)) $fatal(1, "missing +ny"); ny = t32;
    if (!$value$plusargs("nz=%d", t32)) $fatal(1, "missing +nz"); nz = t32;
    if (!$value$plusargs("c=%d", t32)) $fatal(1, "missing +c"); nc = t32;
    if (!$value$plusargs("t=%d", t32)) $fatal(1, "missing +t"); T = t32;
    if (!$value$plusargs("g=%d", t32)) $fatal(1, "missing +g"); G = t32;
    if (!$value$plusargs("pred=%d", t32)) $fatal(1, "missing +pred"); pred = t32;
    if (!$value$plusargs("tmlen=%d", t32)) $fatal(1, "missing +tmlen"); tmlen = t32;
    if (!$value$plusargs("thr=%d", thr)) thr = 0;
    if (!$value$plusargs("id=%s", id)) id = "loop";
    D = nx * ny * nz * nc;
    ede_D = D[ADDR_W:0];
    neps = 8 * nc;
    ng = (D + L - 1) / L;
    lastn = D - (ng - 1) * L;
    $readmemh(f_hdr, hdr, 0, nhdr - 1);
    $readmemh(f_codes, codes, 0, T * D - 1);
    $readmemh(f_dec, dexp, 0, T * D - 1);
    begin : loadchg
      integer fd, rc, fr, el, decb;
      fd = $fopen(f_chg, "r");
      rc = $fscanf(fd, "%d", nexp);
      for (i = 0; i < nexp; i = i + 1) begin
        rc = $fscanf(fd, "%d %d %d", fr, el, decb);
        exp_frame[i] = fr;
        exp_elem[i] = el;
        exp_dec[i] = decb;
      end
      $fclose(fd);
    end
    for (i = 0; i < D; i = i + 1) mirror[i] = 0;
    cyc = 0; hptr = 0; ct = 0; cg = 0; frame = 0; mism = 0; sbytes = 0; in_done = 0;
    cap_n = 0; feed_i = 0; got = 0; mism_e = 0; frame_e = 0; guard = 0; phase2 = 0; cap_feed = 0;
    timeout = 8 * nbytes + 8 * T * D + 4 * nhdr + 8000;
    repeat (2) @(posedge clk);
    #1 rst = 0; start = 1;
    load_in(0, 0); in_x = tx; in_n = tn;
    load_hdr(0); hdr_data = th; hdr_nbytes = thn;
    in_valid = 1;
    hdr_valid = (nhdr > 0);
  end

  always @(posedge clk) if (!rst && !phase2) begin
    cyc = cyc + 1;
    start <= 0;
    if (s_valid && s_ready) sbytes = sbytes + s_nbytes;
    if (in_valid && in_ready) begin
      if (cg == ng - 1) begin cg = 0; ct = ct + 1; end else cg = cg + 1;
      if (ct == T) in_done = 1;
    end
    if (!in_done) begin load_in(ct, cg); in_x <= tx; in_n <= tn; end
    in_valid <= !in_done;
    if (hdr_valid && hdr_ready) hptr = hptr + hbeat(hptr);
    load_hdr(hptr); hdr_data <= th; hdr_nbytes <= thn;
    hdr_valid <= (hptr < nhdr);
    for (l = 0; l < W; l = l + 1) if (d_valid[l]) begin
      mirror[d_elem[ADDR_W*l +: ADDR_W]] = d_code[32*l +: 32];
      if (d_event[l]) begin
        cap_elem[cap_n] = d_elem[ADDR_W*l +: ADDR_W];
        cap_code[cap_n] = d_code[32*l +: 32];
        cap_ev[cap_n] = 1;
        cap_eof[cap_n] = 0;
        cap_last[cap_n] = 0;
        cap_n = cap_n + 1;
      end
    end
    if (d_eof) begin
      for (i = 0; i < D; i = i + 1)
        if (mirror[i] !== dexp[frame * D + i]) mism = mism + 1;
      cap_elem[cap_n] = 0;
      cap_code[cap_n] = 0;
      cap_ev[cap_n] = 0;
      cap_eof[cap_n] = 1;
      cap_last[cap_n] = (frame == T - 1);
      cap_n = cap_n + 1;
      frame = frame + 1;
    end
    if (d_done || d_err || e_err || cyc > timeout) phase2 = 1;
  end

  // Drive EDE from the captured decoder tokens. Nonblocking so the DUT samples
  // the token on the clock after it is presented, the same handshake as
  // scp4d_ede_tb. A blocking valid cleared in this process at the sample edge
  // drops the token before the DUT sees it.
  initial begin
    wait (phase2 === 1'b1);
    feed_i = 0;
    while (feed_i < cap_n && !ede_err) begin
      @(posedge clk);
      while (ede_ready !== 1'b1) @(posedge clk);
      ede_elem <= cap_elem[feed_i];
      ede_code <= cap_code[feed_i];
      ede_event <= cap_ev[feed_i];
      ede_eof <= cap_eof[feed_i];
      ede_last <= cap_last[feed_i];
      ede_valid <= 1;
      @(posedge clk);
      @(posedge clk);
      ede_valid <= 0;
      feed_i = feed_i + 1;
    end
    while (!ede_done && !ede_err && guard < 200000) @(posedge clk);
  end

  always @(posedge clk) if (!rst && phase2) begin
    if (ede_out_valid) begin
      // Element and new decision, in emit order. The frame index in the file is not
      // compared: a bare end-of-frame from the decoder can move the output by one eof.
      if (got >= nexp || exp_elem[got] !== ede_out_elem_w || exp_dec[got] !== ede_out_dec) mism_e = mism_e + 1;
      got = got + 1;
    end
    if (ede_out_eof) frame_e = frame_e + 1;
    guard = guard + 1;
    if (ede_done || ede_err || guard > 200000) begin
      $display("RESULT id=%0s ok=%0d dec_ok=%0d ede_done=%0d ede_err=%0d err_code=%0d cycles=%0d evals=%0d got=%0d nexp=%0d mism_codes=%0d mism_ede=%0d frames=%0d cap=%0d",
        id, (d_done && !d_err && !e_err && mism == 0 && frame == T && ede_done && !ede_err && mism_e == 0 && got == nexp),
        (mism == 0 && frame == T && d_done && !d_err), ede_done, ede_err, ede_err_code, ede_cycles, ede_evals, got, nexp, mism, mism_e, frame, cap_n);
      $finish;
    end
  end
endmodule
`default_nettype wire

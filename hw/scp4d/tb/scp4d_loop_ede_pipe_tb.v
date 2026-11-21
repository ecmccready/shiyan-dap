// TEST ONLY. Concurrent tenc_q -> tdec_s -> scp4d_k1_tap -> scp4d_ede.
// Measures clocks from reset release through EDE done. The tap is the same module
// the place-and-route wrapper instantiates, and it stalls the byte stream while a
// decoder beat is being handed to EDE one token at a time.
`timescale 1ns/1ps
`default_nettype none
module scp4d_loop_ede_pipe_tb;
  parameter integer W = 4;
  parameter integer L = 8;
  localparam integer ADDR_W = 11;
  localparam integer MAX_BYTES = 1 << 20;
  localparam integer MAX_CODES = 1 << 18;
  localparam integer MAX_HDR = 1 << 16;

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
  wire s_valid, dec_ready, room;
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
    .out_data(s_data), .out_nbytes(s_nbytes), .out_valid(s_valid), .out_ready(dec_ready && room),
    .busy(e_busy), .done(e_done), .err(e_err), .err_code(e_code), .cfg_D(e_D));
  scp4d_tdec_s #(.W(W), .ADDR_W(ADDR_W)) dec (
    .clk(clk), .rst(rst), .in_data(s_data), .in_nbytes(s_nbytes), .in_valid(s_valid && room), .in_ready(dec_ready),
    .out_valid(d_valid), .out_elem(d_elem), .out_code(d_code), .out_event(d_event),
    .out_eof(d_eof), .done(d_done), .err(d_err), .unsupported(d_unsup), .err_code(d_code_err),
    .hdr_T(d_T), .hdr_D(d_D), .hdr_G(d_G), .hdr_pred(d_pred), .consumed(d_cons));

  wire ede_valid, ede_ready, ede_event, ede_eof, ede_last, ede_out_valid, ede_out_dec, ede_out_eof, ede_done, ede_err, tap_overflow;
  wire [ADDR_W-1:0] ede_elem, ede_out_elem;
  wire signed [31:0] ede_code;
  wire [31:0] ede_evals, ede_cycles;
  reg [ADDR_W:0] ede_cfg_D = 0;
  scp4d_k1_tap #(.W(W), .A(ADDR_W)) tap (
    .clk(clk), .rst(rst), .nframes(T), .d_event(d_event), .d_elem(d_elem), .d_code(d_code), .d_eof(d_eof), .room(room), .overflow(tap_overflow),
    .ede_valid(ede_valid), .ede_ready(ede_ready), .ede_elem(ede_elem), .ede_code(ede_code),
    .ede_event(ede_event), .ede_eof(ede_eof), .ede_last(ede_last));
  scp4d_ede #(.ADDR_W(ADDR_W), .FAN(4)) ede (
    .clk(clk), .rst(rst), .mode_relations(1'b0), .threshold(32'sd0), .cfg_D(ede_cfg_D),
    .cfg_we(1'b0), .cfg_src({ADDR_W{1'b0}}), .cfg_tgt({4*ADDR_W{1'b0}}), .cfg_vld(4'b0),
    .in_valid(ede_valid), .in_ready(ede_ready), .in_elem(ede_elem), .in_code(ede_code),
    .in_event(ede_event), .in_eof(ede_eof), .in_last(ede_last),
    .out_valid(ede_out_valid), .out_elem(ede_out_elem), .out_decision(ede_out_dec), .out_eof(ede_out_eof),
    .done(ede_done), .err(ede_err), .err_code(), .evals(ede_evals), .cycles(ede_cycles));

  reg [7:0] hdr [0:MAX_HDR-1];
  reg [31:0] codes [0:MAX_CODES-1];
  integer nbytes, nhdr, neps, D, ng, lastn, t32;
  integer cyc, hptr, ct, cg, frame, i, l, guard;
  reg in_done;
  reg [32*L-1:0] tx;
  reg [3:0] tn;
  reg [8*W-1:0] th;
  reg [2:0] thn;
  reg [1023:0] f_codes, f_hdr;

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
    D = nx * ny * nz * nc;
    ede_cfg_D = D[ADDR_W:0];
    neps = 8 * nc;
    ng = (D + L - 1) / L;
    lastn = D - (ng - 1) * L;
    $readmemh(f_hdr, hdr, 0, nhdr - 1);
    $readmemh(f_codes, codes, 0, T * D - 1);
    cyc = 0; hptr = 0; ct = 0; cg = 0; frame = 0; in_done = 0; guard = 0;
    repeat (2) @(posedge clk);
    #1 rst = 0; start = 1;
    load_in(0, 0); in_x = tx; in_n = tn;
    load_hdr(0); hdr_data = th; hdr_nbytes = thn;
    in_valid = 1;
    hdr_valid = (nhdr > 0);
  end

  always @(posedge clk) if (!rst && !ede_done && !ede_err && !d_err && !e_err) begin
    cyc = cyc + 1;
    guard = guard + 1;
    start <= 0;
    if (in_valid && in_ready) begin
      if (cg == ng - 1) begin cg = 0; ct = ct + 1; end else cg = cg + 1;
      if (ct == T) in_done = 1;
    end
    if (!in_done) begin load_in(ct, cg); in_x <= tx; in_n <= tn; end
    in_valid <= !in_done;
    if (hdr_valid && hdr_ready) hptr = hptr + hbeat(hptr);
    load_hdr(hptr); hdr_data <= th; hdr_nbytes <= thn;
    hdr_valid <= (hptr < nhdr);
    if (d_eof) frame = frame + 1;
    if (guard > 2000000) begin
      $display("RESULT ok=0 cycles=%0d ede_cycles=%0d evals=%0d frames=%0d err=timeout", cyc, ede_cycles, ede_evals, frame);
      $finish;
    end
  end

  always @(posedge clk) if (!rst && (ede_done || ede_err || d_err || e_err)) begin
    $display("RESULT ok=%0d cycles=%0d ede_cycles=%0d evals=%0d frames=%0d dec_done=%0d enc_done=%0d ede_err=%0d dec_err=%0d enc_err=%0d overflow=%0d dec_code=%0d enc_code=%0d",
      (ede_done && !ede_err && !d_err && !e_err && !tap_overflow && frame == T), cyc, ede_cycles, ede_evals, frame, d_done, e_done, ede_err, d_err, e_err, tap_overflow, d_code_err, e_code);
    $finish;
  end
endmodule
`default_nettype wire

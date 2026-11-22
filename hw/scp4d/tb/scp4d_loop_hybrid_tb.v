// TEST ONLY. v0.1.23b end-to-end loop on one code grid.
// USE_HYB 0: the v0.1.22 chain (tenc variant, tdec variant, k1_tap, scp4d_ede).
// USE_HYB 1: the same chain with scp4d_hybrid in place of scp4d_ede.
// Prints CHG frame elem decision, then RESULT.
`timescale 1ns/1ps
`default_nettype none
module scp4d_loop_hybrid_tb;
  parameter integer W = 4;
  parameter integer L = 8;
  parameter integer ADDR_W = 11;
  parameter integer USE_HYB = 0;
  localparam integer MAX_BYTES = 1 << 20;
  localparam integer MAX_CODES = 1 << 18;
  localparam integer MAX_HDR = 1 << 16;
  localparam integer MAX_CHG = 1 << 18;

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

  scp4d_tenc_q_w4l8_bram #(.W(W), .L(L), .ADDR_W(ADDR_W)) enc (
    .clk(clk), .rst(rst), .start(start), .cfg_nx(nx), .cfg_ny(ny), .cfg_nz(nz), .cfg_c(nc), .cfg_T(T), .cfg_G(G), .cfg_pred(pred), .cfg_tm_len(tmlen),
    .hdr_data(hdr_data), .hdr_nbytes(hdr_nbytes), .hdr_valid(hdr_valid), .hdr_ready(hdr_ready),
    .in_x(in_x), .in_n(in_n), .in_valid(in_valid), .in_ready(in_ready),
    .out_data(s_data), .out_nbytes(s_nbytes), .out_valid(s_valid), .out_ready(dec_ready && room),
    .busy(e_busy), .done(e_done), .err(e_err), .err_code(e_code), .cfg_D(e_D));
  scp4d_tdec_s_w4_bram #(.W(W), .ADDR_W(ADDR_W)) dec (
    .clk(clk), .rst(rst), .in_data(s_data), .in_nbytes(s_nbytes), .in_valid(s_valid && room), .in_ready(dec_ready),
    .out_valid(d_valid), .out_elem(d_elem), .out_code(d_code), .out_event(d_event),
    .out_eof(d_eof), .done(d_done), .err(d_err), .unsupported(d_unsup), .err_code(d_code_err),
    .hdr_T(d_T), .hdr_D(d_D), .hdr_G(d_G), .hdr_pred(d_pred), .consumed(d_cons));

  wire eng_valid, eng_ready, eng_event, eng_eof, eng_last, eng_ov, eng_od, eng_oe, eng_done, eng_err, tap_overflow;
  wire [ADDR_W-1:0] eng_elem, eng_oelem;
  wire signed [31:0] eng_code;
  wire [31:0] eng_evals, eng_cycles;
  reg [ADDR_W:0] eng_cfg_D = 0;
  scp4d_k1_tap #(.W(W), .A(ADDR_W)) tap (
    .clk(clk), .rst(rst), .nframes(T), .d_event(d_event), .d_elem(d_elem), .d_code(d_code), .d_eof(d_eof), .room(room), .overflow(tap_overflow),
    .ede_valid(eng_valid), .ede_ready(eng_ready), .ede_elem(eng_elem), .ede_code(eng_code),
    .ede_event(eng_event), .ede_eof(eng_eof), .ede_last(eng_last));
  generate
    if (USE_HYB != 0) begin : ghy
      scp4d_hybrid #(.ADDR_W(ADDR_W), .FAN(4)) hy (
        .clk(clk), .rst(rst), .mode_relations(1'b0), .threshold(32'sd0), .cfg_D(eng_cfg_D),
        .cfg_we(1'b0), .cfg_src({ADDR_W{1'b0}}), .cfg_tgt({4*ADDR_W{1'b0}}), .cfg_vld(4'b0),
        .in_valid(eng_valid), .in_ready(eng_ready), .in_elem(eng_elem), .in_code(eng_code),
        .in_event(eng_event), .in_eof(eng_eof), .in_last(eng_last),
        .out_valid(eng_ov), .out_elem(eng_oelem), .out_decision(eng_od), .out_eof(eng_oe),
        .sel_fsd(), .done(eng_done), .err(eng_err), .err_code(), .evals(eng_evals), .cycles(eng_cycles));
    end else begin : ged
      scp4d_ede #(.ADDR_W(ADDR_W), .FAN(4)) ed (
        .clk(clk), .rst(rst), .mode_relations(1'b0), .threshold(32'sd0), .cfg_D(eng_cfg_D),
        .cfg_we(1'b0), .cfg_src({ADDR_W{1'b0}}), .cfg_tgt({4*ADDR_W{1'b0}}), .cfg_vld(4'b0),
        .in_valid(eng_valid), .in_ready(eng_ready), .in_elem(eng_elem), .in_code(eng_code),
        .in_event(eng_event), .in_eof(eng_eof), .in_last(eng_last),
        .out_valid(eng_ov), .out_elem(eng_oelem), .out_decision(eng_od), .out_eof(eng_oe),
        .done(eng_done), .err(eng_err), .err_code(), .evals(eng_evals), .cycles(eng_cycles));
    end
  endgenerate

  reg [7:0] hdr [0:MAX_HDR-1];
  reg [31:0] codes [0:MAX_CODES-1];
  integer nbytes, nhdr, neps, D, ng, lastn, t32;
  integer cyc, hptr, ct, cg, frame, guard, nchg, fi;
  reg in_done;
  reg [32*L-1:0] tx;
  reg [3:0] tn;
  reg [8*W-1:0] th;
  reg [2:0] thn;
  reg [1023:0] f_codes, f_hdr;
  integer chg_f [0:MAX_CHG-1];
  integer chg_e [0:MAX_CHG-1];
  integer chg_d [0:MAX_CHG-1];

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
    eng_cfg_D = D[ADDR_W:0];
    neps = 8 * nc;
    ng = (D + L - 1) / L;
    lastn = D - (ng - 1) * L;
    $readmemh(f_hdr, hdr, 0, nhdr - 1);
    $readmemh(f_codes, codes, 0, T * D - 1);
    cyc = 0; hptr = 0; ct = 0; cg = 0; frame = 0; in_done = 0; guard = 0; nchg = 0;
    repeat (2) @(posedge clk);
    #1 rst = 0; start = 1;
    load_in(0, 0); in_x = tx; in_n = tn;
    load_hdr(0); hdr_data = th; hdr_nbytes = thn;
    in_valid = 1;
    hdr_valid = (nhdr > 0);
  end

  always @(posedge clk) if (!rst && !eng_done && !eng_err && !d_err && !e_err) begin
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
    if (eng_valid && eng_ready && eng_event) $display("EV %0d %0d", eng_elem, eng_code);
    if (eng_valid && eng_ready && eng_eof) $display("EVF");
    if (eng_ov && nchg < MAX_CHG) begin
      chg_f[nchg] = frame; chg_e[nchg] = eng_oelem; chg_d[nchg] = eng_od; nchg = nchg + 1;
    end
    if (eng_oe) frame = frame + 1;
    if (guard > 4000000) begin
      $display("RESULT ok=0 cycles=%0d eng_cycles=%0d evals=%0d frames=%0d nchg=%0d err=timeout", cyc, eng_cycles, eng_evals, frame, nchg);
      $finish;
    end
  end

  always @(posedge clk) if (!rst && (eng_done || eng_err || d_err || e_err)) begin
    if (eng_oe) frame = frame + 1;
    if (eng_ov && nchg < MAX_CHG) begin
      chg_f[nchg] = frame; chg_e[nchg] = eng_oelem; chg_d[nchg] = eng_od; nchg = nchg + 1;
    end
    for (fi = 0; fi < nchg; fi = fi + 1) $display("CHG %0d %0d %0d", chg_f[fi], chg_e[fi], chg_d[fi]);
    $display("RESULT ok=%0d cycles=%0d eng_cycles=%0d evals=%0d frames=%0d nchg=%0d dec_done=%0d enc_done=%0d eng_err=%0d dec_err=%0d enc_err=%0d overflow=%0d",
      (eng_done && !eng_err && !d_err && !e_err && !tap_overflow && frame == T),
      cyc, eng_cycles, eng_evals, frame, nchg, d_done, e_done, eng_err, d_err, e_err, tap_overflow);
    $finish;
  end
endmodule
`default_nettype wire

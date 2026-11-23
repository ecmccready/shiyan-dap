// TEST ONLY. v0.1.27 held-out bench for wrap_loop_hnfast. Frozen percent 55.
`timescale 1ns/1ps
`default_nettype none
module scp4d_loop_v0127_held_tb;
  parameter integer W = 4;
  parameter integer L = 8;
  parameter integer ADDR_W = 11;
  parameter integer ENGINE = 0;
  localparam integer MAX_HDR = 1 << 16;
  localparam integer MAX_CODES = 1 << 18;

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
  scp4d_tdec_s_w4_fast #(.W(W), .ADDR_W(ADDR_W)) dec (
    .clk(clk), .rst(rst), .in_data(s_data), .in_nbytes(s_nbytes), .in_valid(s_valid && room), .in_ready(dec_ready),
    .out_valid(d_valid), .out_elem(d_elem), .out_code(d_code), .out_event(d_event),
    .out_eof(d_eof), .done(d_done), .err(d_err), .unsupported(d_unsup), .err_code(d_code_err),
    .hdr_T(d_T), .hdr_D(d_D), .hdr_G(d_G), .hdr_pred(d_pred), .consumed(d_cons));

  wire eng_valid, eng_ready, eng_event, eng_eof, eng_last, eng_ov, eng_od, eng_oe, eng_done, eng_err, eng_sel, tap_overflow;
  wire [ADDR_W-1:0] eng_elem, eng_oelem;
  wire signed [31:0] eng_code;
  wire [31:0] eng_evals, eng_cycles;
  reg [ADDR_W:0] eng_cfg_D = 0;
  scp4d_k1_tap #(.W(W), .A(ADDR_W)) tap (
    .clk(clk), .rst(rst), .nframes(T), .d_event(d_event), .d_elem(d_elem), .d_code(d_code), .d_eof(d_eof), .room(room), .overflow(tap_overflow),
    .ede_valid(eng_valid), .ede_ready(eng_ready), .ede_elem(eng_elem), .ede_code(eng_code),
    .ede_event(eng_event), .ede_eof(eng_eof), .ede_last(eng_last));
  wire [3:0] hit, hdec;
  wire [4*ADDR_W-1:0] helems;
  scp4d_hybrid_n #(.ADDR_W(ADDR_W), .FAN(4)) hy (
    .clk(clk), .rst(rst), .mode_relations(1'b0), .threshold(32'sd0), .cfg_D(eng_cfg_D),
    .cfg_we(1'b0), .cfg_src({ADDR_W{1'b0}}), .cfg_tgt({4*ADDR_W{1'b0}}), .cfg_vld(4'b0),
    .in_valid(eng_valid), .in_ready(eng_ready), .in_elem(eng_elem), .in_code(eng_code),
    .in_event(eng_event), .in_eof(eng_eof), .in_last(eng_last),
    .out_valid(eng_ov), .out_elem(eng_oelem), .out_decision(eng_od),
    .out_hit(hit), .out_elem_n(helems), .out_dec_n(hdec), .out_eof(eng_oe),
    .sel_fsd(eng_sel), .done(eng_done), .err(eng_err), .err_code(), .evals(eng_evals), .cycles(eng_cycles));

  reg [7:0] hdr [0:MAX_HDR-1];
  reg [31:0] codes [0:MAX_CODES-1];
  integer nbytes, nhdr, neps, D, ng, lastn, t32;
  integer cyc, hptr, ct, cg, frame, guard;
  integer busy, idle, handoff, tap_full, enc_stall, out_stall;
  integer prev_eng, frame_events;
  reg in_done, prev_sel;
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
    if (!$value$plusargs("nbytes=%d", nbytes)) nbytes = 0;
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
    cyc = 0; hptr = 0; ct = 0; cg = 0; frame = 0; in_done = 0; guard = 0;
    busy = 0; idle = 0; handoff = 0; tap_full = 0; enc_stall = 0; out_stall = 0;
    prev_eng = 0; frame_events = 0; prev_sel = 0;
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
    if (!eng_ready) busy = busy + 1;
    else if (eng_valid) handoff = handoff + 1;
    else idle = idle + 1;
    if (!room) tap_full = tap_full + 1;
    if (in_valid && !in_ready) enc_stall = enc_stall + 1;
    if (s_valid && !(dec_ready && room)) out_stall = out_stall + 1;
    if (eng_valid && eng_ready && eng_event) frame_events = frame_events + 1;
    if (eng_ov) $display("CHG %0d %0d %0d", frame, eng_oelem, eng_od);
    if (hit[0]) $display("CHG %0d %0d %0d", frame, helems[ADDR_W-1:0], hdec[0]);
    if (hit[1]) $display("CHG %0d %0d %0d", frame, helems[2*ADDR_W-1:ADDR_W], hdec[1]);
    if (hit[2]) $display("CHG %0d %0d %0d", frame, helems[3*ADDR_W-1:2*ADDR_W], hdec[2]);
    if (hit[3]) $display("CHG %0d %0d %0d", frame, helems[4*ADDR_W-1:3*ADDR_W], hdec[3]);
    if (eng_oe) begin
      $display("FRAME %0d %0d %0d %0d %0d %0d %0d %0d %0d %0d %0d %0d",
        frame, busy + idle + handoff, eng_cycles - prev_eng, busy, idle, handoff,
        tap_full, enc_stall, out_stall, frame_events, eng_sel, (frame != 0 && eng_sel != prev_sel));
      prev_eng = eng_cycles;
      prev_sel = eng_sel;
      busy = 0; idle = 0; handoff = 0; tap_full = 0; enc_stall = 0; out_stall = 0; frame_events = 0;
      frame = frame + 1;
    end
    if (guard > 4000000) begin
      $display("TOTAL ok=0 cycles=%0d", cyc);
      $finish;
    end
  end

  always @(posedge clk) if (!rst && (eng_done || eng_err || d_err || e_err)) begin
    if (eng_oe) begin
      $display("FRAME %0d %0d %0d %0d %0d %0d %0d %0d %0d %0d %0d %0d",
        frame, busy + idle + handoff, eng_cycles - prev_eng, busy, idle, handoff,
        tap_full, enc_stall, out_stall, frame_events, eng_sel, (frame != 0 && eng_sel != prev_sel));
      frame = frame + 1;
    end
    $display("TOTAL ok=%0d cycles=%0d eng_cycles=%0d evals=%0d frames=%0d overflow=%0d",
      (eng_done && !eng_err && !d_err && !e_err && !tap_overflow && frame == T),
      cyc, eng_cycles, eng_evals, frame, tap_overflow);
    $finish;
  end
endmodule
`default_nettype wire

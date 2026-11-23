// TEST ONLY. v0.1.27 hybrid loop. New wrapper only.
// scp4d_tenc_q_w4l8_bram -> scp4d_tdec_s_w4_fast -> scp4d_k1_tap -> scp4d_hybrid_n.
// N=4 was frozen before the held-out runs. The v0.1.25 decoder is not edited.
`default_nettype none
module wrap_loop_hnfast #(parameter integer W = 4, parameter integer L = 8, parameter integer A = 11) (
  input wire clk, input wire rst, input wire start, input wire cfg_bit,
  input wire signed [31:0] threshold, input wire [A:0] cfg_D,
  input wire [8*W-1:0] hdr_data, input wire [2:0] hdr_nbytes, input wire hdr_valid, output wire hdr_ready,
  input wire [31:0] x_pins, input wire [3:0] in_n, input wire in_valid, output wire in_ready,
  output wire [15:0] sig, output wire done, output wire err);
  reg [134:0] cfg_sr;
  reg [32*L-1:0] x_sr;
  always @(posedge clk) begin cfg_sr <= {cfg_sr[133:0], cfg_bit}; x_sr <= {x_sr, x_pins}; end
  wire [8*W-1:0] sd; wire [2:0] sn; wire sv, dec_ready, bz, ed, ee; wire [4:0] ec; wire [A:0] cd;
  wire room;
  scp4d_tenc_q_w4l8_bram #(.W(W), .L(L), .ADDR_W(A)) enc (.clk(clk), .rst(rst), .start(start),
    .cfg_nx(cfg_sr[15:0]), .cfg_ny(cfg_sr[31:16]), .cfg_nz(cfg_sr[47:32]), .cfg_c(cfg_sr[63:48]), .cfg_T(cfg_sr[95:64]),
    .cfg_G(cfg_sr[100:96]), .cfg_pred(cfg_sr[102:101]), .cfg_tm_len(cfg_sr[134:103]),
    .hdr_data(hdr_data), .hdr_nbytes(hdr_nbytes), .hdr_valid(hdr_valid), .hdr_ready(hdr_ready),
    .in_x(x_sr), .in_n(in_n), .in_valid(in_valid), .in_ready(in_ready),
    .out_data(sd), .out_nbytes(sn), .out_valid(sv), .out_ready(dec_ready && room),
    .busy(bz), .done(ed), .err(ee), .err_code(ec), .cfg_D(cd));
  wire [W-1:0] ov, oe; wire [W*A-1:0] el; wire [W*32-1:0] oc; wire eof, uns, de; wire [4:0] dc;
  wire [31:0] hT, cons; wire [A:0] hD; wire [4:0] hG; wire [1:0] hp;
  scp4d_tdec_s_w4_fast #(.W(W), .ADDR_W(A)) dec (.clk(clk), .rst(rst), .in_data(sd), .in_nbytes(sn), .in_valid(sv && room), .in_ready(dec_ready),
    .out_valid(ov), .out_elem(el), .out_code(oc), .out_event(oe), .out_eof(eof), .done(), .err(de), .unsupported(uns),
    .err_code(dc), .hdr_T(hT), .hdr_D(hD), .hdr_G(hG), .hdr_pred(hp), .consumed(cons));
  wire hy_valid, hy_ready, hy_event, hy_eof, hy_last, hy_ov, hy_od, hy_oe, hy_done, hy_err, hy_sel, tap_overflow;
  wire [A-1:0] hy_elem, hy_oelem;
  wire signed [31:0] hy_code;
  wire [3:0] ecode, hit, hdec;
  wire [4*A-1:0] helems;
  wire [31:0] evals, cycles;
  scp4d_k1_tap #(.W(W), .A(A)) tap (
    .clk(clk), .rst(rst), .nframes(cfg_sr[95:64]), .d_event(oe), .d_elem(el), .d_code(oc), .d_eof(eof), .room(room), .overflow(tap_overflow),
    .ede_valid(hy_valid), .ede_ready(hy_ready), .ede_elem(hy_elem), .ede_code(hy_code),
    .ede_event(hy_event), .ede_eof(hy_eof), .ede_last(hy_last));
  scp4d_hybrid_n #(.ADDR_W(A), .FAN(4)) hy (
    .clk(clk), .rst(rst), .mode_relations(1'b0), .threshold(threshold), .cfg_D(cfg_D),
    .cfg_we(1'b0), .cfg_src({A{1'b0}}), .cfg_tgt({4*A{1'b0}}), .cfg_vld(4'b0),
    .in_valid(hy_valid), .in_ready(hy_ready), .in_elem(hy_elem), .in_code(hy_code),
    .in_event(hy_event), .in_eof(hy_eof), .in_last(hy_last),
    .out_valid(hy_ov), .out_elem(hy_oelem), .out_decision(hy_od),
    .out_hit(hit), .out_elem_n(helems), .out_dec_n(hdec), .out_eof(hy_oe),
    .sel_fsd(hy_sel), .done(hy_done), .err(hy_err), .err_code(ecode), .evals(evals), .cycles(cycles));
  assign done = hy_done;
  assign err = ee | de | hy_err | tap_overflow;
  scp4d_fold16 #(.N(W*(A+34) + 6*A + 95)) fo (.clk(clk),
    .d({ov, oe, el, oc, eof, uns, dc, hy_oelem, hy_ov, hy_od, hy_oe, hy_sel, hit, hdec, helems, ecode, evals, cycles, bz, ed, ec, cd}), .sig(sig));
endmodule
`default_nettype wire

// TEST ONLY. Place-and-route wrappers for K1. Not the simulation testbench.
// wrap_ede is temporal-only when REL=0 and relations-mode when REL=1.
// wrap_fsd is the full-scan baseline. wrap_loop_ede is tenc_q -> tdec_s -> scp4d_ede
// (temporal-only; tdec_s rejects relations), with scp4d_k1_tap holding one decoder
// token on the EDE pins and stalling the byte stream when the queue cannot take
// another beat. Outputs are XOR-folded by scp4d_fold16, same as the v0.1.19 wrappers.
`default_nettype none
module wrap_ede #(parameter integer A = 11, parameter integer REL = 0) (
  input wire clk, input wire rst, input wire signed [31:0] threshold, input wire [A:0] cfg_D,
  input wire cfg_bit, input wire cfg_stb,
  input wire in_valid, output wire in_ready, input wire [A-1:0] in_elem, input wire signed [31:0] in_code,
  input wire in_event, input wire in_eof, input wire in_last,
  output wire [15:0] sig, output wire done, output wire err);
  localparam integer FAN = 4;
  reg [FAN*A + FAN + A - 1:0] cfg_sr;
  always @(posedge clk) cfg_sr <= {cfg_sr[FAN*A + FAN + A - 2:0], cfg_bit};
  wire [A-1:0] out_elem;
  wire out_valid, out_decision, out_eof, ede_err;
  wire [3:0] err_code;
  wire [31:0] evals, cycles;
  scp4d_ede #(.ADDR_W(A), .FAN(FAN)) dut (
    .clk(clk), .rst(rst), .mode_relations(REL != 0), .threshold(threshold), .cfg_D(cfg_D),
    .cfg_we(REL != 0 && cfg_stb), .cfg_src(cfg_sr[A-1:0]), .cfg_tgt(cfg_sr[FAN*A+A-1:A]), .cfg_vld(cfg_sr[FAN*A+FAN+A-1:FAN*A+A]),
    .in_valid(in_valid), .in_ready(in_ready), .in_elem(in_elem), .in_code(in_code),
    .in_event(in_event), .in_eof(in_eof), .in_last(in_last),
    .out_valid(out_valid), .out_elem(out_elem), .out_decision(out_decision), .out_eof(out_eof),
    .done(done), .err(ede_err), .err_code(err_code), .evals(evals), .cycles(cycles));
  assign err = ede_err;
  scp4d_fold16 #(.N(A + 1 + 1 + 1 + 4 + 32 + 32)) fo (
    .clk(clk), .d({out_elem, out_valid, out_decision, out_eof, err_code, evals, cycles}), .sig(sig));
endmodule

module wrap_fsd #(parameter integer A = 11) (
  input wire clk, input wire rst, input wire signed [31:0] threshold, input wire [A:0] cfg_D,
  input wire in_valid, output wire in_ready, input wire [A-1:0] in_elem, input wire signed [31:0] in_code,
  input wire in_event, input wire in_eof, input wire in_last,
  output wire [15:0] sig, output wire done, output wire err);
  wire [A-1:0] out_elem;
  wire out_valid, out_decision, out_eof, fsd_err;
  wire [3:0] err_code;
  wire [31:0] evals, cycles;
  scp4d_fsd #(.ADDR_W(A)) dut (
    .clk(clk), .rst(rst), .threshold(threshold), .cfg_D(cfg_D),
    .in_valid(in_valid), .in_ready(in_ready), .in_elem(in_elem), .in_code(in_code),
    .in_event(in_event), .in_eof(in_eof), .in_last(in_last),
    .out_valid(out_valid), .out_elem(out_elem), .out_decision(out_decision), .out_eof(out_eof),
    .done(done), .err(fsd_err), .err_code(err_code), .evals(evals), .cycles(cycles));
  assign err = fsd_err;
  scp4d_fold16 #(.N(A + 1 + 1 + 1 + 4 + 32 + 32)) fo (
    .clk(clk), .d({out_elem, out_valid, out_decision, out_eof, err_code, evals, cycles}), .sig(sig));
endmodule

// v0.1.16 scp4d_tenc_q (W, L) -> v0.1.18 scp4d_tdec_s (same W) -> scp4d_k1_tap -> scp4d_ede.
module wrap_loop_ede #(parameter integer W = 4, parameter integer L = 8, parameter integer A = 11) (
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
  scp4d_tenc_q #(.W(W), .L(L), .ADDR_W(A)) enc (.clk(clk), .rst(rst), .start(start),
    .cfg_nx(cfg_sr[15:0]), .cfg_ny(cfg_sr[31:16]), .cfg_nz(cfg_sr[47:32]), .cfg_c(cfg_sr[63:48]), .cfg_T(cfg_sr[95:64]),
    .cfg_G(cfg_sr[100:96]), .cfg_pred(cfg_sr[102:101]), .cfg_tm_len(cfg_sr[134:103]),
    .hdr_data(hdr_data), .hdr_nbytes(hdr_nbytes), .hdr_valid(hdr_valid), .hdr_ready(hdr_ready),
    .in_x(x_sr), .in_n(in_n), .in_valid(in_valid), .in_ready(in_ready),
    .out_data(sd), .out_nbytes(sn), .out_valid(sv), .out_ready(dec_ready && room),
    .busy(bz), .done(ed), .err(ee), .err_code(ec), .cfg_D(cd));
  wire [W-1:0] ov, oe; wire [W*A-1:0] el; wire [W*32-1:0] oc; wire eof, uns, de; wire [4:0] dc;
  wire [31:0] hT, cons; wire [A:0] hD; wire [4:0] hG; wire [1:0] hp;
  scp4d_tdec_s #(.W(W), .ADDR_W(A)) dec (.clk(clk), .rst(rst), .in_data(sd), .in_nbytes(sn), .in_valid(sv && room), .in_ready(dec_ready),
    .out_valid(ov), .out_elem(el), .out_code(oc), .out_event(oe), .out_eof(eof), .done(), .err(de), .unsupported(uns),
    .err_code(dc), .hdr_T(hT), .hdr_D(hD), .hdr_G(hG), .hdr_pred(hp), .consumed(cons));
  wire ede_valid, ede_ready, ede_event, ede_eof, ede_last, ede_out_valid, ede_out_dec, ede_out_eof, ede_done, ede_err, tap_overflow;
  wire [A-1:0] ede_elem, ede_out_elem;
  wire signed [31:0] ede_code;
  wire [3:0] ecode;
  wire [31:0] evals, cycles;
  scp4d_k1_tap #(.W(W), .A(A)) tap (
    .clk(clk), .rst(rst), .nframes(cfg_sr[95:64]), .d_event(oe), .d_elem(el), .d_code(oc), .d_eof(eof), .room(room), .overflow(tap_overflow),
    .ede_valid(ede_valid), .ede_ready(ede_ready), .ede_elem(ede_elem), .ede_code(ede_code),
    .ede_event(ede_event), .ede_eof(ede_eof), .ede_last(ede_last));
  scp4d_ede #(.ADDR_W(A), .FAN(4)) ede (
    .clk(clk), .rst(rst), .mode_relations(1'b0), .threshold(threshold), .cfg_D(cfg_D),
    .cfg_we(1'b0), .cfg_src({A{1'b0}}), .cfg_tgt({4*A{1'b0}}), .cfg_vld(4'b0),
    .in_valid(ede_valid), .in_ready(ede_ready), .in_elem(ede_elem), .in_code(ede_code),
    .in_event(ede_event), .in_eof(ede_eof), .in_last(ede_last),
    .out_valid(ede_out_valid), .out_elem(ede_out_elem), .out_decision(ede_out_dec), .out_eof(ede_out_eof),
    .done(ede_done), .err(ede_err), .err_code(ecode), .evals(evals), .cycles(cycles));
  assign done = ede_done;
  assign err = ee | de | ede_err | tap_overflow;
  scp4d_fold16 #(.N(W*(A+34) + 2*A + 86)) fo (.clk(clk),
    .d({ov, oe, el, oc, eof, uns, dc, ede_out_elem, ede_out_valid, ede_out_dec, ede_out_eof, ecode, evals, cycles, bz, ed, ec, cd}), .sig(sig));
endmodule
`default_nettype wire

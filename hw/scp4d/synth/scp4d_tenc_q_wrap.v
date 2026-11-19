// TEST ONLY. Place-and-route wrappers for the v0.1.16 encoder (short emitter path) synthesis estimates (yosys +
// nextpnr only; not used in simulation). Same wrapper logic as scp4d_tenc_wrap.v (v0.1.14) and scp4d_tenc_p_wrap.v (v0.1.15, both
// unchanged): uses scp4d_fold16 from scp4d_pnr_wrap.v (v0.1.13, unchanged). The encoder's
// configuration (135 bits) is loaded through a 1-bit serial shift register and its L x 32-bit code
// input through a 32-bit pin bus shifted into an L-word register (the packages do not have
// 32L + 135 input pins); every output is registered and XOR-folded to 16 pins so no logic can be
// optimised away. The same wrapper logic is added to every configuration.
`default_nettype none
module wrap_tenc_q #(parameter integer W = 4, parameter integer L = 8, parameter integer A = 11) (
  input wire clk, input wire rst, input wire start, input wire cfg_bit,
  input wire [8*W-1:0] hdr_data, input wire [2:0] hdr_nbytes, input wire hdr_valid, output wire hdr_ready,
  input wire [31:0] x_pins, input wire [3:0] in_n, input wire in_valid, output wire in_ready,
  input wire out_ready, output wire [15:0] sig, output wire done, output wire err);
  reg [134:0] cfg_sr;
  reg [32*L-1:0] x_sr;
  always @(posedge clk) begin cfg_sr <= {cfg_sr[133:0], cfg_bit}; x_sr <= {x_sr, x_pins}; end
  wire [8*W-1:0] od; wire [2:0] on; wire ov, bz; wire [4:0] ec; wire [A:0] cd;
  scp4d_tenc_q #(.W(W), .L(L), .ADDR_W(A)) dut (.clk(clk), .rst(rst), .start(start),
    .cfg_nx(cfg_sr[15:0]), .cfg_ny(cfg_sr[31:16]), .cfg_nz(cfg_sr[47:32]), .cfg_c(cfg_sr[63:48]), .cfg_T(cfg_sr[95:64]),
    .cfg_G(cfg_sr[100:96]), .cfg_pred(cfg_sr[102:101]), .cfg_tm_len(cfg_sr[134:103]),
    .hdr_data(hdr_data), .hdr_nbytes(hdr_nbytes), .hdr_valid(hdr_valid), .hdr_ready(hdr_ready),
    .in_x(x_sr), .in_n(in_n), .in_valid(in_valid), .in_ready(in_ready),
    .out_data(od), .out_nbytes(on), .out_valid(ov), .out_ready(out_ready),
    .busy(bz), .done(done), .err(err), .err_code(ec), .cfg_D(cd));
  scp4d_fold16 #(.N(8*W + 3 + 1 + 1 + 5 + A + 1)) fo (.clk(clk), .d({od, on, ov, bz, ec, cd}), .sig(sig));
endmodule

// pipelined encoder (W) -> v0.1.13 scp4d_tdec_w (same W), as in hw/scp4d/tb/scp4d_loop_q_tb.v
module wrap_loop_q #(parameter integer W = 4, parameter integer L = 8, parameter integer A = 11) (
  input wire clk, input wire rst, input wire start, input wire cfg_bit,
  input wire [8*W-1:0] hdr_data, input wire [2:0] hdr_nbytes, input wire hdr_valid, output wire hdr_ready,
  input wire [31:0] x_pins, input wire [3:0] in_n, input wire in_valid, output wire in_ready,
  output wire [15:0] sig, output wire done, output wire err);
  reg [134:0] cfg_sr;
  reg [32*L-1:0] x_sr;
  always @(posedge clk) begin cfg_sr <= {cfg_sr[133:0], cfg_bit}; x_sr <= {x_sr, x_pins}; end
  wire [8*W-1:0] sd; wire [2:0] sn; wire sv, sr, bz, ed, ee; wire [4:0] ec; wire [A:0] cd;
  scp4d_tenc_q #(.W(W), .L(L), .ADDR_W(A)) enc (.clk(clk), .rst(rst), .start(start),
    .cfg_nx(cfg_sr[15:0]), .cfg_ny(cfg_sr[31:16]), .cfg_nz(cfg_sr[47:32]), .cfg_c(cfg_sr[63:48]), .cfg_T(cfg_sr[95:64]),
    .cfg_G(cfg_sr[100:96]), .cfg_pred(cfg_sr[102:101]), .cfg_tm_len(cfg_sr[134:103]),
    .hdr_data(hdr_data), .hdr_nbytes(hdr_nbytes), .hdr_valid(hdr_valid), .hdr_ready(hdr_ready),
    .in_x(x_sr), .in_n(in_n), .in_valid(in_valid), .in_ready(in_ready),
    .out_data(sd), .out_nbytes(sn), .out_valid(sv), .out_ready(sr),
    .busy(bz), .done(ed), .err(ee), .err_code(ec), .cfg_D(cd));
  wire [W-1:0] ov, oe; wire [W*A-1:0] el; wire [W*32-1:0] oc; wire eof, uns, de; wire [4:0] dc;
  wire [31:0] hT, cons; wire [A:0] hD; wire [4:0] hG; wire [1:0] hp;
  scp4d_tdec_w #(.W(W), .ADDR_W(A)) dec (.clk(clk), .rst(rst), .in_data(sd), .in_nbytes(sn), .in_valid(sv), .in_ready(sr),
    .out_valid(ov), .out_elem(el), .out_code(oc), .out_event(oe), .out_eof(eof), .done(done), .err(de), .unsupported(uns),
    .err_code(dc), .hdr_T(hT), .hdr_D(hD), .hdr_G(hG), .hdr_pred(hp), .consumed(cons));
  assign err = ee | de;
  scp4d_fold16 #(.N(W*(A+34) + 1 + 1 + 5 + 32 + A + 1 + 5 + 2 + 32 + 1 + 1 + 5 + A + 1)) fo (.clk(clk),
    .d({ov, oe, el, oc, eof, uns, dc, hT, hD, hG, hp, cons, bz, ed, ec, cd}), .sig(sig));
endmodule
`default_nettype wire

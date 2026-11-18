// TEST ONLY. Place-and-route wrappers for the v0.1.13 synthesis estimates (yosys + nextpnr only).
// The W = 4 decoders have more top-level ports than the ECP5 / iCE40 packages have pins, so every
// decoder (the v0.1.11 / v0.1.12 baselines included, for a like-for-like comparison) is placed
// inside the same thin wrapper: stream inputs stay on pins; every decoder output is registered
// and XOR-folded into a registered 16-bit signature (so no output logic can be optimised away);
// the relation-program port (rdec only) is loaded through a 1-bit serial shift register.
// The wrapper adds the same small amount of logic to every configuration. Not used in simulation.
`default_nettype none
module scp4d_fold16 #(parameter integer N = 64) (input wire clk, input wire [N-1:0] d, output reg [15:0] sig);
  reg [N-1:0] q;
  reg [15:0] f;
  integer i;
  always @(*) begin
    f = 16'd0;
    for (i = 0; i < N; i = i + 1) f[i & 15] = f[i & 15] ^ q[i];
  end
  always @(posedge clk) begin q <= d; sig <= f; end
endmodule

module scp4d_cfg_shift (input wire clk, input wire rst, input wire cfg_bit, input wire cfg_we_in,
                        output reg cfg_we, output reg [1:0] cfg_sel, output reg [15:0] cfg_addr, output reg [47:0] cfg_data);
  reg [65:0] sr;
  always @(posedge clk) begin
    sr <= {sr[64:0], cfg_bit};
    cfg_we <= cfg_we_in && rst;
    cfg_sel <= sr[65:64]; cfg_addr <= sr[63:48]; cfg_data <= sr[47:0];
  end
endmodule

module wrap_tdec_w #(parameter integer W = 2, parameter integer A = 11) (
  input wire clk, input wire rst, input wire [8*W-1:0] in_data, input wire [2:0] in_nbytes, input wire in_valid,
  output wire in_ready, output wire [15:0] sig, output wire done, output wire err);
  wire [W-1:0] ov, oe; wire [W*A-1:0] el; wire [W*32-1:0] oc; wire eof, uns; wire [4:0] ec;
  wire [31:0] hT, cons; wire [A:0] hD; wire [4:0] hG; wire [1:0] hp;
  scp4d_tdec_w #(.W(W), .ADDR_W(A)) dut (.clk(clk), .rst(rst), .in_data(in_data), .in_nbytes(in_nbytes), .in_valid(in_valid), .in_ready(in_ready),
    .out_valid(ov), .out_elem(el), .out_code(oc), .out_event(oe), .out_eof(eof), .done(done), .err(err), .unsupported(uns),
    .err_code(ec), .hdr_T(hT), .hdr_D(hD), .hdr_G(hG), .hdr_pred(hp), .consumed(cons));
  scp4d_fold16 #(.N(W*(A+34) + 1 + 1 + 5 + 32 + A + 1 + 5 + 2 + 32)) fo (.clk(clk), .d({ov, oe, el, oc, eof, uns, ec, hT, hD, hG, hp, cons}), .sig(sig));
endmodule

module wrap_tdec #(parameter integer A = 11) (
  input wire clk, input wire rst, input wire [7:0] in_data, input wire [2:0] in_nbytes, input wire in_valid,
  output wire in_ready, output wire [15:0] sig, output wire done, output wire err);
  wire ov, oe; wire [A-1:0] el; wire [31:0] oc; wire eof, uns; wire [4:0] ec;
  wire [31:0] hT; wire [A:0] hD; wire [4:0] hG; wire [1:0] hp;
  scp4d_tdec #(.ADDR_W(A)) dut (.clk(clk), .rst(rst), .in_data(in_data), .in_valid(in_valid), .in_ready(in_ready),
    .out_valid(ov), .out_elem(el), .out_code(oc), .out_event(oe), .out_eof(eof), .done(done), .err(err), .unsupported(uns),
    .err_code(ec), .hdr_T(hT), .hdr_D(hD), .hdr_G(hG), .hdr_pred(hp));
  scp4d_fold16 #(.N(A + 34 + 1 + 1 + 5 + 32 + A + 1 + 5 + 2 + 3)) fo (.clk(clk), .d({ov, oe, el, oc, eof, uns, ec, hT, hD, hG, hp, in_nbytes}), .sig(sig));
endmodule

module wrap_rdec_w #(parameter integer W = 2, parameter integer A = 11, parameter integer RW = 10, parameter integer FW = 11) (
  input wire clk, input wire rst, input wire cfg_bit, input wire cfg_we_in, input wire [8*W-1:0] in_data, input wire [2:0] in_nbytes,
  input wire in_valid, output wire in_ready, output wire [15:0] sig, output wire done, output wire err);
  wire cwe; wire [1:0] csel; wire [15:0] caddr; wire [47:0] cdata;
  scp4d_cfg_shift cs (.clk(clk), .rst(rst), .cfg_bit(cfg_bit), .cfg_we_in(cfg_we_in), .cfg_we(cwe), .cfg_sel(csel), .cfg_addr(caddr), .cfg_data(cdata));
  wire ov, oe, eof, uns, hr; wire [A-1:0] el; wire [31:0] oc, hT, cons; wire [4:0] ec, hG; wire [A:0] hD;
  scp4d_rdec_w #(.W(W), .ADDR_W(A), .REL_W(RW), .FAN_W(FW)) dut (.clk(clk), .rst(rst), .cfg_we(cwe), .cfg_sel(csel), .cfg_addr(caddr), .cfg_data(cdata),
    .in_data(in_data), .in_nbytes(in_nbytes), .in_valid(in_valid), .in_ready(in_ready),
    .out_valid(ov), .out_elem(el), .out_code(oc), .out_event(oe), .out_eof(eof), .done(done), .err(err), .unsupported(uns),
    .err_code(ec), .hdr_T(hT), .hdr_D(hD), .hdr_G(hG), .hdr_rel(hr), .consumed(cons));
  scp4d_fold16 #(.N(1 + 1 + A + 32 + 1 + 1 + 5 + 32 + A + 1 + 5 + 1 + 32)) fo (.clk(clk), .d({ov, oe, el, oc, eof, uns, ec, hT, hD, hG, hr, cons}), .sig(sig));
endmodule

module wrap_rdec #(parameter integer A = 11, parameter integer RW = 10, parameter integer FW = 11) (
  input wire clk, input wire rst, input wire cfg_bit, input wire cfg_we_in, input wire [7:0] in_data, input wire [2:0] in_nbytes,
  input wire in_valid, output wire in_ready, output wire [15:0] sig, output wire done, output wire err);
  wire cwe; wire [1:0] csel; wire [15:0] caddr; wire [47:0] cdata;
  scp4d_cfg_shift cs (.clk(clk), .rst(rst), .cfg_bit(cfg_bit), .cfg_we_in(cfg_we_in), .cfg_we(cwe), .cfg_sel(csel), .cfg_addr(caddr), .cfg_data(cdata));
  wire ov, oe, eof, uns, hr; wire [A-1:0] el; wire [31:0] oc, hT; wire [4:0] ec, hG; wire [A:0] hD;
  scp4d_rdec #(.ADDR_W(A), .REL_W(RW), .FAN_W(FW)) dut (.clk(clk), .rst(rst), .cfg_we(cwe), .cfg_sel(csel), .cfg_addr(caddr), .cfg_data(cdata),
    .in_data(in_data), .in_valid(in_valid), .in_ready(in_ready),
    .out_valid(ov), .out_elem(el), .out_code(oc), .out_event(oe), .out_eof(eof), .done(done), .err(err), .unsupported(uns),
    .err_code(ec), .hdr_T(hT), .hdr_D(hD), .hdr_G(hG), .hdr_rel(hr));
  scp4d_fold16 #(.N(1 + 1 + A + 32 + 1 + 1 + 5 + 32 + A + 1 + 5 + 1 + 3)) fo (.clk(clk), .d({ov, oe, el, oc, eof, uns, ec, hT, hD, hG, hr, in_nbytes}), .sig(sig));
endmodule
`default_nettype wire

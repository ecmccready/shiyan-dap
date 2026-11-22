// TEST ONLY. Place-and-route wrapper for scp4d_hybrid. ADDR_W 8 is the default.
// REL 0 is temporal-only. The selector, both engines and the code mirror stay in the netlist.
`default_nettype none
module wrap_hybrid #(parameter integer A = 8, parameter integer REL = 0) (
  input wire clk, input wire rst, input wire signed [31:0] threshold, input wire [A:0] cfg_D,
  input wire cfg_bit, input wire cfg_stb,
  input wire in_valid, output wire in_ready, input wire [A-1:0] in_elem, input wire signed [31:0] in_code,
  input wire in_event, input wire in_eof, input wire in_last,
  output wire [15:0] sig, output wire done, output wire err);
  localparam integer FAN = 4;
  reg [FAN*A + FAN + A - 1:0] cfg_sr;
  always @(posedge clk) cfg_sr <= {cfg_sr[FAN*A + FAN + A - 2:0], cfg_bit};
  wire [A-1:0] out_elem;
  wire out_valid, out_decision, out_eof, sel_fsd, hy_err;
  wire [3:0] err_code;
  wire [31:0] evals, cycles;
  scp4d_hybrid #(.ADDR_W(A), .FAN(FAN)) dut (
    .clk(clk), .rst(rst), .mode_relations(REL != 0), .threshold(threshold), .cfg_D(cfg_D),
    .cfg_we(REL != 0 && cfg_stb), .cfg_src(cfg_sr[A-1:0]), .cfg_tgt(cfg_sr[FAN*A+A-1:A]), .cfg_vld(cfg_sr[FAN*A+FAN+A-1:FAN*A+A]),
    .in_valid(in_valid), .in_ready(in_ready), .in_elem(in_elem), .in_code(in_code),
    .in_event(in_event), .in_eof(in_eof), .in_last(in_last),
    .out_valid(out_valid), .out_elem(out_elem), .out_decision(out_decision), .out_eof(out_eof),
    .sel_fsd(sel_fsd), .done(done), .err(hy_err), .err_code(err_code), .evals(evals), .cycles(cycles));
  assign err = hy_err;
  scp4d_fold16 #(.N(A + 1 + 1 + 1 + 1 + 4 + 32 + 32)) fo (
    .clk(clk), .d({out_elem, out_valid, out_decision, out_eof, sel_fsd, err_code, evals, cycles}), .sig(sig));
endmodule
`default_nettype wire

// TEST ONLY. v0.1.22 encoder variant. Same ports as scp4d_tenc_q with L = 8.
// Each accepted beat is handed to an unchanged L = 4 scp4d_tenc_q as one or two
// beats of at most 4 lanes, in element order. Output bytes match that encoder.
// scp4d_tenc_q.v is unchanged. A beat wider than 4 lanes costs one extra cycle.
`timescale 1ns/1ps
`default_nettype none
module scp4d_tenc_q_w4l8_bram #(
  parameter integer W      = 4,
  parameter integer L      = 8,
  parameter integer ADDR_W = 11,
  parameter integer G_MAX  = 16
) (
  input  wire                 clk,
  input  wire                 rst,
  input  wire                 start,
  input  wire [15:0]          cfg_nx,
  input  wire [15:0]          cfg_ny,
  input  wire [15:0]          cfg_nz,
  input  wire [15:0]          cfg_c,
  input  wire [31:0]          cfg_T,
  input  wire [4:0]           cfg_G,
  input  wire [1:0]           cfg_pred,
  input  wire [31:0]          cfg_tm_len,
  input  wire [8*W-1:0]       hdr_data,
  input  wire [2:0]           hdr_nbytes,
  input  wire                 hdr_valid,
  output wire                 hdr_ready,
  input  wire [32*L-1:0]      in_x,
  input  wire [3:0]           in_n,
  input  wire                 in_valid,
  output wire                 in_ready,
  output wire [8*W-1:0]       out_data,
  output wire [2:0]           out_nbytes,
  output wire                 out_valid,
  input  wire                 out_ready,
  output wire                 busy,
  output wire                 done,
  output wire                 err,
  output wire [4:0]           err_code,
  output wire [ADDR_W:0]      cfg_D
);
  localparam integer H = 4;
  reg phase;
  reg [32*H-1:0] hold_x;
  reg [3:0] hold_n;
  wire i_ready;
  wire [32*H-1:0] i_x = phase ? hold_x : in_x[32*H-1:0];
  wire [3:0] i_n = phase ? hold_n : ((in_n > H) ? H[3:0] : in_n);
  wire i_valid = phase || in_valid;

  assign in_ready = !phase && i_ready;

  always @(posedge clk) begin
    if (rst) phase <= 1'b0;
    else if (i_valid && i_ready) begin
      if (!phase && (in_n > H)) begin
        hold_x <= in_x[32*L-1:32*H];
        hold_n <= in_n - H[3:0];
        phase <= 1'b1;
      end else phase <= 1'b0;
    end
  end

  wire i_busy, i_done, i_err;
  scp4d_tenc_q #(.W(W), .L(H), .ADDR_W(ADDR_W), .G_MAX(G_MAX)) core (
    .clk(clk), .rst(rst), .start(start),
    .cfg_nx(cfg_nx), .cfg_ny(cfg_ny), .cfg_nz(cfg_nz), .cfg_c(cfg_c), .cfg_T(cfg_T),
    .cfg_G(cfg_G), .cfg_pred(cfg_pred), .cfg_tm_len(cfg_tm_len),
    .hdr_data(hdr_data), .hdr_nbytes(hdr_nbytes), .hdr_valid(hdr_valid), .hdr_ready(hdr_ready),
    .in_x(i_x), .in_n(i_n), .in_valid(i_valid), .in_ready(i_ready),
    .out_data(out_data), .out_nbytes(out_nbytes), .out_valid(out_valid), .out_ready(out_ready),
    .busy(i_busy), .done(i_done), .err(i_err), .err_code(err_code), .cfg_D(cfg_D));
  assign busy = i_busy || phase;
  assign done = i_done && !phase;
  assign err = i_err;
endmodule
`default_nettype wire

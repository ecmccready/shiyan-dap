// TEST ONLY. UART wrapper versus a direct scp4d_hybrid_ff on the same token.
// File bridge: the plusarg +STIM is optional. This bench builds one frame itself.
`timescale 1ns/1ps
`default_nettype none
module scp4d_uart_ff_tb;
  localparam integer CLKS = 4;
  localparam integer W = 4;
  localparam integer TOK = 6;
  reg clk = 0;
  reg rst_n = 0;
  always #5 clk = ~clk;

  reg [7:0] frame [0:15];
  integer flen;
  reg tx_bit;
  wire rx_bit;
  wire led0_n, led1_n;
  wire [7:0] got;
  wire got_v;
  reg [7:0] resp [0:63];
  integer rn;

  function [15:0] crc16_byte;
    input [15:0] crc_in;
    input [7:0] b;
    integer i;
    reg [15:0] c;
    begin
      c = crc_in ^ {b, 8'h00};
      for (i = 0; i < 8; i = i + 1) begin
        if (c[15]) c = {c[14:0], 1'b0} ^ 16'h1021;
        else c = {c[14:0], 1'b0};
      end
      crc16_byte = c;
    end
  endfunction

  reg [7:0] txd;
  reg txv;
  wire txready;
  scp4d_uart_tx #(.CLKS(CLKS)) host_tx (.clk(clk), .rst(~rst_n), .data(txd), .valid(txv), .ready(txready), .tx(tx_bit));
  wrap_uart_ff #(.ADDR_W(8), .W(W), .CLKS(CLKS)) dut (
    .clk(clk), .rst_n(rst_n), .rx(tx_bit), .tx(rx_bit), .led0_n(led0_n), .led1_n(led1_n));
  scp4d_uart_rx #(.CLKS(CLKS)) host_rx (.clk(clk), .rst(~rst_n), .rx(rx_bit), .data(got), .valid(got_v));

  wire ref_ready, ref_ov, ref_od, ref_oe, ref_done, ref_err, ref_sel;
  wire [7:0] ref_elem;
  wire [3:0] ref_hit, ref_dec, ref_ecode;
  wire [31:0] ref_elems;
  wire [31:0] ref_evals, ref_cycles;
  reg ref_v;
  scp4d_hybrid_ff #(.ADDR_W(8), .FAN(4), .PERCENT(8), .HOLD(1)) href (
    .clk(clk), .rst(~rst_n), .mode_relations(1'b0), .threshold(32'sd0), .cfg_D(9'd16),
    .cfg_we(1'b0), .cfg_src(8'b0), .cfg_tgt(32'b0), .cfg_vld(4'b0),
    .in_valid(ref_v), .in_ready(ref_ready), .in_elem(8'd0), .in_code(32'sd1),
    .in_event(1'b1), .in_eof(1'b1), .in_last(1'b1),
    .out_valid(ref_ov), .out_elem(ref_elem), .out_decision(ref_od),
    .out_hit(ref_hit), .out_elem_n(ref_elems), .out_dec_n(ref_dec), .out_eof(ref_oe),
    .sel_fsd(ref_sel), .done(ref_done), .err(ref_err), .err_code(ref_ecode),
    .evals(ref_evals), .cycles(ref_cycles));

  reg [7:0] golden [0:15];
  integer gn;
  integer i;
  reg [15:0] c;
  reg sent_ref;
  always @(posedge clk) if (rst_n && got_v && rn < 64) begin resp[rn] = got; rn = rn + 1; end

  initial begin
    txv = 0; txd = 0; ref_v = 0; sent_ref = 0; rn = 0; gn = 0;
    frame[0] = 8'd4;
    frame[1] = 8'd0;
    frame[2] = 8'd1;
    frame[3] = 8'd0;
    frame[4] = 8'd0;
    frame[5] = 8'd0;
    frame[6] = 8'b0000_0111;
    c = 16'hFFFF;
    for (i = 0; i < 7; i = i + 1) c = crc16_byte(c, frame[i]);
    flen = 11;
    repeat (4) @(posedge clk);
    rst_n = 1;
    @(posedge clk);
    send(8'hA5);
    send(8'd7);
    send(8'd0);
    for (i = 0; i < 7; i = i + 1) send(frame[i]);
    send(c[7:0]);
    send(c[15:8]);
    // Direct engine, same token, after reset has been released.
    @(posedge clk);
    while (!ref_ready) @(posedge clk);
    ref_v <= 1;
    @(posedge clk);
    while (!ref_ready) @(posedge clk);
    ref_v <= 0;
    while (!ref_done) begin
      @(posedge clk);
      if (ref_ov) begin
        golden[gn] = ref_elem;
        golden[gn+1] = {7'b0, ref_od};
        golden[gn+2] = {6'b0, ref_sel, ref_oe};
        gn = gn + 3;
      end
    end
    repeat (CLKS * 40 * 20) @(posedge clk);
    if (rn < 4) begin
      $display("FAIL uart response bytes %0d fault %b gn %0d", rn, led1_n, gn);
      $finish(1);
    end
    if (resp[0] !== 8'hA5) begin $display("FAIL sync %02x rn=%0d", resp[0], rn); $finish(1); end
    if (resp[1] !== gn[7:0]) begin
      $display("FAIL length %0d want %0d rn=%0d", resp[1], gn, rn);
      $finish(1);
    end
    for (i = 0; i < gn; i = i + 1) begin
      if (resp[2+i] !== golden[i]) begin
        $display("FAIL decision byte %0d got %02x want %02x", i, resp[2+i], golden[i]);
        $finish(1);
      end
    end
    $display("PASS uart-ff bit-exact decisions=%0d", gn/3);
    $finish(0);
  end

  task send;
    input [7:0] b;
    begin
      @(posedge clk);
      while (!txready) @(posedge clk);
      txd <= b;
      txv <= 1;
      @(posedge clk);
      txv <= 0;
      @(posedge clk);
      while (!txready) @(posedge clk);
    end
  endtask

  initial begin
    #5_000_000;
    $display("FAIL timeout");
    $finish(1);
  end
endmodule
`default_nettype wire

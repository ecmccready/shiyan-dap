// TEST ONLY. File bridge. The Node driver writes +STIM. This bench sends those
// bytes into wrap_uart_ff_d and compares the reply with a direct hybrid_ff.
`timescale 1ns/1ps
`default_nettype none
module scp4d_uart_file_tb;
  localparam integer CLKS = 4;
  localparam integer D = 256;
  reg clk = 0;
  reg rst_n = 0;
  always #5 clk = ~clk;

  reg [7:0] stim [0:4095];
  integer stim_n;
  reg [7:0] txd;
  reg txv;
  wire txready, tx_bit, rx_bit, led0_n, led1_n;
  wire [7:0] got;
  wire got_v;
  reg [7:0] resp [0:4095];
  integer rn;
  reg [7:0] golden [0:4095];
  integer gn;

  scp4d_uart_tx #(.CLKS(CLKS)) host_tx (.clk(clk), .rst(~rst_n), .data(txd), .valid(txv), .ready(txready), .tx(tx_bit));
  wrap_uart_ff_pipe #(.ADDR_W(8), .W(4), .CLKS(CLKS), .CFG_D(D)) dut (
    .clk(clk), .rst_n(rst_n), .rx(tx_bit), .tx(rx_bit), .led0_n(led0_n), .led1_n(led1_n));
  scp4d_uart_rx #(.CLKS(CLKS)) host_rx (.clk(clk), .rst(~rst_n), .rx(rx_bit), .data(got), .valid(got_v));

  reg ref_v, ref_ev, ref_eof, ref_last;
  reg [7:0] ref_el;
  reg signed [31:0] ref_code;
  wire ref_ready, ref_ov, ref_od, ref_oe, ref_done, ref_err, ref_sel;
  wire [7:0] ref_oelem;
  wire [3:0] ref_hit, ref_dec, ref_ecode;
  wire [31:0] ref_elems;
  wire [31:0] ref_evals, ref_cycles;
  scp4d_hybrid_ff #(.ADDR_W(8), .FAN(4), .PERCENT(8), .HOLD(1)) href (
    .clk(clk), .rst(~rst_n), .mode_relations(1'b0), .threshold(32'sd0), .cfg_D(9'd256),
    .cfg_we(1'b0), .cfg_src(8'b0), .cfg_tgt(32'b0), .cfg_vld(4'b0),
    .in_valid(ref_v), .in_ready(ref_ready), .in_elem(ref_el), .in_code(ref_code),
    .in_event(ref_ev), .in_eof(ref_eof), .in_last(ref_last),
    .out_valid(ref_ov), .out_elem(ref_oelem), .out_decision(ref_od),
    .out_hit(ref_hit), .out_elem_n(ref_elems), .out_dec_n(ref_dec), .out_eof(ref_oe),
    .sel_fsd(ref_sel), .done(ref_done), .err(ref_err), .err_code(ref_ecode),
    .evals(ref_evals), .cycles(ref_cycles));

  always @(posedge clk) if (rst_n && got_v && rn < 4096) begin resp[rn] = got; rn = rn + 1; end
  always @(posedge clk) if (rst_n && ref_ov && gn + 3 <= 4096) begin
    golden[gn] = ref_oelem; golden[gn+1] = {7'b0, ref_od}; golden[gn+2] = {6'b0, ref_sel, ref_oe}; gn = gn + 3;
  end
  always @(posedge clk) if (rst_n && ref_sel && gn + 12 <= 4096) begin
    if (ref_hit[0]) begin golden[gn] = ref_elems[7:0]; golden[gn+1] = {7'b0, ref_dec[0]}; golden[gn+2] = {6'b0, 1'b1, ref_oe}; gn = gn + 3; end
    if (ref_hit[1]) begin golden[gn] = ref_elems[15:8]; golden[gn+1] = {7'b0, ref_dec[1]}; golden[gn+2] = {6'b0, 1'b1, ref_oe}; gn = gn + 3; end
    if (ref_hit[2]) begin golden[gn] = ref_elems[23:16]; golden[gn+1] = {7'b0, ref_dec[2]}; golden[gn+2] = {6'b0, 1'b1, ref_oe}; gn = gn + 3; end
    if (ref_hit[3]) begin golden[gn] = ref_elems[31:24]; golden[gn+1] = {7'b0, ref_dec[3]}; golden[gn+2] = {6'b0, 1'b1, ref_oe}; gn = gn + 3; end
  end

  integer i, ti, ntok, fd;
  reg [1023:0] stim_path;
  task send;
    input [7:0] b;
    begin
      @(posedge clk);
      while (!txready) @(posedge clk);
      txd <= b; txv <= 1;
      @(posedge clk);
      txv <= 0;
      @(posedge clk);
      while (!txready) @(posedge clk);
    end
  endtask

  initial begin
    txv = 0; txd = 0; ref_v = 0; rn = 0; gn = 0; stim_n = 0;
    if (!$value$plusargs("STIM=%s", stim_path)) begin $display("FAIL no stim"); $finish(1); end
    fd = $fopen(stim_path, "rb");
    if (fd == 0) begin $display("FAIL open"); $finish(1); end
    stim_n = $fread(stim, fd);
    $fclose(fd);
    repeat (4) @(posedge clk);
    rst_n = 1;
    for (i = 0; i < stim_n; i = i + 1) send(stim[i]);
    // payload starts at byte 3; byte 0 of payload is W. Tokens are 6 bytes.
    ntok = (stim[1] + (stim[2] << 8) - 1) / 6;
    @(posedge clk);
    for (ti = 0; ti < ntok; ti = ti + 1) begin
      while (!ref_ready) @(posedge clk);
      ref_el <= stim[3 + 1 + ti * 6];
      ref_code <= {stim[3 + 1 + ti * 6 + 4], stim[3 + 1 + ti * 6 + 3], stim[3 + 1 + ti * 6 + 2], stim[3 + 1 + ti * 6 + 1]};
      ref_ev <= stim[3 + 1 + ti * 6 + 5][0];
      ref_eof <= stim[3 + 1 + ti * 6 + 5][1];
      ref_last <= stim[3 + 1 + ti * 6 + 5][2];
      ref_v <= 1;
      @(posedge clk);
      while (!ref_ready) @(posedge clk);
      ref_v <= 0;
    end
    while (!ref_done) @(posedge clk);
    repeat (CLKS * 20 * (stim_n + 8)) @(posedge clk);
    if (rn < 4) begin
      $display("FAIL short reply rn=%0d gn=%0d st=%0d ntok=%0d tidx=%0d fault=%b done=%b err=%b", rn, gn, dut.st, dut.ntok, dut.tidx, dut.fault, dut.hy_done, dut.hy_err);
      $finish(1);
    end
    if (resp[0] !== 8'hA5) begin $display("FAIL sync"); $finish(1); end
    if (resp[1] !== gn[7:0] || resp[2] !== gn[15:8]) begin
      $display("FAIL length got %0d %0d want %0d", resp[1], resp[2], gn);
      $finish(1);
    end
    for (i = 0; i < gn; i = i + 1) begin
      if (resp[3 + i] !== golden[i]) begin
        $display("FAIL byte %0d got %02x want %02x", i, resp[3 + i], golden[i]);
        $finish(1);
      end
    end
    for (i = 0; i < gn; i = i + 3) $display("REC %0d %0d", golden[i], golden[i + 1][0]);
    $display("PASS uart-file bit-exact records=%0d", gn / 3);
    $finish(0);
  end
  initial begin #200_000_000; $display("FAIL timeout"); $finish(1); end
endmodule
`default_nettype wire

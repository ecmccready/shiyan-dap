// TEST ONLY. New variant. wrap_uart_ff and scp4d_hybrid_ff are not edited.
// 100 MHz LVDS board clock (P3/P4) is divided to 20 MHz by EHXPLLL.
// 20_000_000 / 160 = 125_000 baud exactly. Power is needs real board.
`default_nettype none
module wrap_uart_versa (
  input  wire clk_p,
  input  wire clk_n,
  input  wire rst_n,
  input  wire rx,
  output wire tx,
  output wire led0_n,
  output wire led1_n
);
  wire clk100 = clk_p;
  wire clk20;
  wire locked;
  (* keep *) wire clk_n_keep = clk_n;
  (* FREQUENCY_PIN_CLKI = "100.0" *)
  (* FREQUENCY_PIN_CLKOP = "20.0" *)
  EHXPLLL #(
    .CLKI_DIV(1),
    .CLKFB_DIV(4),
    .CLKOP_DIV(20),
    .CLKOP_CPHASE(19),
    .CLKOP_FPHASE(0),
    .CLKOP_ENABLE("ENABLED"),
    .CLKOS_ENABLE("DISABLED"),
    .CLKOS2_ENABLE("DISABLED"),
    .CLKOS3_ENABLE("DISABLED"),
    .FEEDBK_PATH("CLKOP"),
    .CLKOP_TRIM_DELAY(0),
    .CLKOP_TRIM_POL("FALLING"),
    .OUTDIVIDER_MUXA("DIVA"),
    .OUTDIVIDER_MUXB("DIVB"),
    .OUTDIVIDER_MUXC("DIVC"),
    .OUTDIVIDER_MUXD("DIVD"),
    .PLLRST_ENA("DISABLED"),
    .INTFB_WAKE("DISABLED"),
    .STDBY_ENABLE("DISABLED"),
    .DPHASE_SOURCE("DISABLED")
  ) pll (
    .CLKI(clk100),
    .CLKFB(clk20),
    .PHASESEL1(1'b0),
    .PHASESEL0(1'b0),
    .PHASEDIR(1'b0),
    .PHASESTEP(1'b0),
    .PHASELOADREG(1'b0),
    .STDBY(1'b0),
    .PLLWAKESYNC(1'b0),
    .RST(1'b0),
    .ENCLKOP(1'b0),
    .ENCLKOS(1'b0),
    .ENCLKOS2(1'b0),
    .ENCLKOS3(1'b0),
    .CLKOP(clk20),
    .CLKOS(),
    .CLKOS2(),
    .CLKOS3(),
    .LOCK(locked),
    .INTLOCK(),
    .REFCLK(),
    .CLKINTFB()
  );
  // clk_n is the LVDS complement. The constraint places it. Keep it live.
  wrap_uart_ff_pipe #(.ADDR_W(8), .W(4), .CLKS(160), .CFG_D(256)) u (
    .clk(clk20), .rst_n(rst_n), .rx(rx), .tx(tx), .led0_n(led0_n), .led1_n(led1_n));
endmodule
`default_nettype wire

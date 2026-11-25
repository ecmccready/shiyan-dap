# ECP5 Versa UART prototype

`wrap_uart_ff` is a new module around `scp4d_hybrid_ff`. The earlier RTL files are unchanged. This image has not been loaded on a board. Power is **needs real board**.

## What the guide states

Source: Lattice *ECP5 Versa Development Board User Guide*, FPGA-EB-02021-2.4, November 2021. The connections in that guide are for LFE5UM-45F-8BG381C. The 5G board (LFE5UM5G-45F) is a different document, FPGA-EB-02048.

- Section 7.1: a 100 MHz LVDS oscillator is connected to balls P3 and P4 and must be used as an LVDS input. `IO_TYPE=LVDS`. On CABGA381, nextpnr maps P3 to `X0/Y68/PIOC` and P4 to `X0/Y68/PIOD`. The differential input is the P3 port only. P4 is the complement of that pair. A second LVDS port on PIOD makes nextpnr exit 125 with `cannot place differential IO at location PIOD`.
- Section 6.2: SW1 drives the dedicated GSRN pin to 0 while pressed. The guide does not publish a user-IO ball for that pin, so it is not in the LPF.
- Table 8.1: SW3 position 1 is ball H2. Inputs 1–4 are a 1.5 V bank, so `IO_TYPE=LVCMOS15`. ON is logic 0. `rst_n` uses this switch, not GSRN.
- Table 8.2: D25 is ball E16 (yellow) and D24 is ball D17 (yellow). The bank is 2.5 V, so `IO_TYPE=LVCMOS25`. The LED lights when the pin is low.
- Appendix A schematic, bank 0 (the 3.3 V bank, so `IO_TYPE=LVCMOS33`): `PT36A/PCLKT0_1` is ball A11 and net `RXD_UART`. `PT38A/PCLKT0_0` is ball C11 and net `TXD_UART`. Lattice KB 7556: `TXD_UART` is the FT2232H transmitter (BDBUS0), so the FPGA pin is an input (`rx` = C11). `RXD_UART` is the FT2232H receiver (BDBUS1), so the FPGA pin is an output (`tx` = A11).
- Section 5: J2 is the USB-B connector for that FT2232H UART and for programming. The same USB device is an FT2232HL (bill of materials item U5 in the guide). J50's default jumpers are 1–2, 3–4 and 5–6, which select the ECP5 rather than only the ispClock. Channel 0 of that FT2232H is the JTAG channel used by OpenOCD (`ftdi channel 0` in the LiteX config). The UART is the second channel. The guide does not give a separate channel number in a table; the schematic names the UART nets on the FT2232H B-bus.
- Corroboration only: `litex-boards` `litex_boards/platforms/lattice_versa_ecp5.py` uses rx C11, tx A11, clk P3, leds E16 and D17. It is not the source of the balls.

The 5G board is FPGA-EB-02048 and was not the source of these balls. The bitstream is built with `nextpnr-ecp5 --um-45k`, which is LFE5UM-45F, the part named in FPGA-EB-02021.

## Frame

Host to FPGA, 8N1:

1. `0xA5`
2. payload length, little-endian uint16
3. payload
4. CRC-16/CCITT-FALSE (init `0xFFFF`, poly `0x1021`) of the payload, little-endian

The payload's first byte is `W` (4 in this wrapper). Each token is then 6 bytes: `elem`, `code` little-endian int32, flags (`bit0` event, `bit1` eof, `bit2` last). The reply is `0xA5`, one length byte, that many decision bytes (`elem`, decision, flags), then the same CRC. `cfg_D` inside the wrapper is 16, percent 8, hold 1, so one event stays on K1.

FT601 USB3 FIFO is not in this wrapper.

## Commands

Pinned tools: OSS CAD Suite 20261118, Yosys 0.71+50 583f380c6, nextpnr-ecp5 0.11.1-103-ge811ba48. `router2`, `--45k` (recorded in this repo as LFE5U-45F) package CABGA381, seeds 1–5, one at a time. The Versa guide's device is LFE5UM-45F-8BG381C. The route used `--45k`, not a separate UM part flag.

The table below is the earlier `wrap_uart_ff` route (`--45k`, LFE5U-45F). It is not `wrap_uart_versa`. The Versa image is in `docs/hw/versa-runbook.md` and `fixtures/scp/versa-bitstream/summary.json`.

Measured 2026-11-24, 19:51:59–19:53:45 UTC. All five seeds routed. Median Fmax is 24.44569206237793 MHz (seed 3). `TRELLIS_COMB` 6666, FF 2713, `DP16KD` 19.

| Seed | Fmax (MHz) | Route wall (s) |
| ---: | ---: | ---: |
| 1 | 25.441408157348633 | 20.586 |
| 2 | 23.886873245239258 | 20.666 |
| 3 | 24.44569206237793 | 18.766 |
| 4 | 24.10277557373047 | 16.774 |
| 5 | 24.928953170776367 | 17.988 |

```text
export PATH="/opt/eda/oss-cad-suite/bin:$PATH"
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/bench-ecp5-uart-ff.ts --all
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/scp-uart-driver.ts
```

The bench stops at the nextpnr report. It does not write a `.cfg` or a bitstream, and nothing was flashed. The guide's programming path is the on-board USB controller on J2 (Diamond) or the J3 JTAG header after removing R38, R33, R32 and R36 (section 5.1). `ecppack` is in the pinned suite; a bitstream command is not recorded here because that step was not run.

## Receipt

The runner signs with `HW_RECEIPT_PRIVATE_KEY` (32-byte hex seed). That value stays on the runner. The server checks `HW_RECEIPT_PUBLIC_KEY` and, only if `HW_RECEIPT_DATABASE_URL` is set, inserts into `shiyan.hw_receipts`. Migration `db/migrations/007_shiyan_hw_receipts.sql` is unapplied. Nothing here writes Level 4.

```text
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/scp-hw-receipt.ts
```

Add `--submit http://127.0.0.1:3000/api/v1/hw/receipts` only against a server whose database is not production and whose migration 007 has been applied by hand.

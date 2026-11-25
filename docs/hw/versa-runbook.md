# Versa board runbook

The bitstream is built and has not been loaded on a board. Status: bitstream ready, awaiting physical board. Power is **needs real board**. No PHI. The private key is never committed.

Pins are in `docs/hw/ecp5-versa-uart.md` (FPGA-EB-02021-2.4, November 2021). The part in the bitstream is LFE5UM-45F (`nextpnr-ecp5 --um-45k` package CABGA381). LiteX `litex_boards/platforms/lattice_versa_ecp5.py` uses the same UART balls (rx C11, tx A11), the same clock ball (P3, LVDS, complement not a second port), LEDs E16 and D17, and DIP H2. LiteX names a different reset ball (T1). This image uses H2 because section 6.2's GSRN pin has no user-IO ball and table 8.1 lists H2 as SW3 position 1.

## Measured route

Pinned tools, confirmed on this run: OSS CAD Suite 20261118, Yosys 0.71+50 (git sha1 583f380c6), nextpnr-ecp5 0.11.1-103-ge811ba48. `--um-45k`, router2, `--freq 100`, `--timing-allow-fail`, seeds 1–5 one at a time, 7,200 s bound. The procedure hash, committed before this run, is `3c90ab6f158e6cda1516b52b8437d5ed45fddb484f03871c1acd8a29fa7dd176`.

Yosys wall 4.163 s. Netlist sha256 `dfc6628f6929003a837c5153dff3adcd52565e4708f7937dc847f104b6d94180`. All five seeds routed. `ecppack` wall 0.73 s. The median is seed 2, 53.61930465698242 MHz. That is above the pre-registered 35–40 MHz window. No delay was added. `TRELLIS_COMB` 2447/43848 (5.580642218573253%), `TRELLIS_FF` 1412/43848, `DP16KD` 28/108.

| Seed | Fmax (MHz) | Path (ns) | Route wall (s) | From | To |
| ---: | ---: | ---: | ---: | --- | --- |
| 1 | 51.6635627746582 | 19.35599996894598 | 8.718 | `u.hy.ede.in_ready_TRELLIS_FF_Q` | `u.hy.use_fsd_TRELLIS_FF_Q` |
| 2 | 53.61930465698242 | 18.649999879300594 | 6.882 | `u.hy.ede.in_ready_TRELLIS_FF_Q` | `u.hy.use_fsd_TRELLIS_FF_Q` |
| 3 | 53.94615936279297 | 18.537000060081482 | 7.781 | `u.hy.play_TRELLIS_FF_Q` | `u.nrec_bytes_TRELLIS_FF_Q_1` |
| 4 | 56.09154510498047 | 17.828000001609325 | 7.329 | `u.feed_TRELLIS_FF_Q` | `u.hy.use_fsd_TRELLIS_FF_Q` |
| 5 | 52.59006118774414 | 19.014999978244305 | 7.594 | `u.hy.ede.in_ready_TRELLIS_FF_Q` | `u.hy.use_fsd_TRELLIS_FF_Q` |

The earlier `wrap_uart_ff` critical path was 40.906999967992306 ns, from `need_TRELLIS_FF_Q` through the runtime divide to `hy.in_code_TRELLIS_FF_Q_26`, median 24.44569206237793 MHz, 6,666/43,848 COMB. This image does not edit that file.

Icarus, not a fit: seed 9 fraction 0.01, two frames, 6 tokens, 2 records. Seed 13 fraction 0.55, two frames, 282 tokens, 135 records. Both match the direct `scp4d_hybrid_ff` and `stepEde` / `stepFsd`.

Median-seed files, sha256:

- `fixtures/scp/versa-bitstream/wrap_uart_versa-seed2.bit` `a433b1461c28dcb847726647cb5eb597b7002b0a99ab2ee5b6f7448b08dc426b`
- `fixtures/scp/versa-bitstream/wrap_uart_versa-seed2.svf` `eb44d7b0b82ceb3d626b8e78e0e99453c51e577f27b03383a42fd5b8bb2daa44`
- `fixtures/scp/versa-bitstream/wrap_uart_versa-seed2.spi.bit` `99b43d5fc31e5ab7312d72e64bb3f993ec2a59ca2d5798d38f1566767e65afc5`

## Install

The pinned tools are OSS CAD Suite 20261118: Yosys 0.71+50 583f380c6, nextpnr-ecp5 0.11.1-103-ge811ba48, and the `ecppack` in that same tree.

```text
export PATH="/opt/eda/oss-cad-suite/bin:$PATH"
```

## Build

One command. It runs Yosys, then five LFE5UM-45F seeds one at a time (7,200 s bound), then `ecppack` for the median-Fmax seed. The measured walls are in the table above.

```text
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/build-versa-bitstream.ts
```

Outputs, for the seed named in `fixtures/scp/versa-bitstream/summary.json`:

- `wrap_uart_versa-seed<N>.bit` and `.svf` (`ecppack --compress`)
- `wrap_uart_versa-seed<N>.spi.bit` (`ecppack --compress --spimode fast-read`)

The logic clock is 20 MHz from an EHXPLLL on the 100 MHz oscillator (`CLKI_DIV=1`, `CLKFB_DIV=4`, `CLKOP_DIV=20`). The UART divisor is 160, so the baud is exactly 125000. Do not open the port at 115200.

Host to FPGA, 8N1: `0xA5`, payload length as a little-endian uint16, payload, CRC-16/CCITT-FALSE (init `0xFFFF`, poly `0x1021`) of the payload, little-endian. The payload's first byte is `W` (4). Each token is 6 bytes: `elem`, `code` little-endian int32, flags (`bit0` event, `bit1` eof, `bit2` last). The reply has the same shape. `cfg_D` is 256, percent 8, hold 1. This is not the one-byte length used by the older `wrap_uart_ff` note in `docs/hw/ecp5-versa-uart.md`.

## Flash

Nothing in this repo was flashed. The guide's programming connector is J2 (USB-B). J3 is the alternate JTAG header and needs R38, R33, R32 and R36 removed (section 5.1).

SRAM, openFPGALoader board name `ecp5_evn` (listed by `openFPGALoader --list-boards` in this toolchain; the cable type it prints is ft2232). Confirm the cable enumerates before using it:

```text
openFPGALoader -b ecp5_evn fixtures/scp/versa-bitstream/wrap_uart_versa-seed2.bit
```

SPI flash, same cable, using the fast-read bitstream:

```text
openFPGALoader -b ecp5_evn -f fixtures/scp/versa-bitstream/wrap_uart_versa-seed2.spi.bit
```

Diamond Programmer is the path the user guide describes for the on-board USB controller. Point it at the `.bit` for a volatile load. This repo did not run Diamond.

## Serial port

The UART is the FT2232H B-port (`RXD_UART` / `TXD_UART` on BDBUS). On Linux it is the second tty of that USB device, often `/dev/ttyUSB1` when `/dev/ttyUSB0` is the JTAG channel. Check `dmesg` after plug-in. Do not guess the number if two devices appear.

WSL2 does not see the USB device until Windows attaches it:

```text
usbipd list
usbipd bind --busid <BUSID>
usbipd attach --wsl --busid <BUSID>
```

Windows Device Manager shows the UART as a COM port. The driver flag below takes a path, so a Windows COM name has to be the form the runtime opens (`\\.\COMn` is not wired here; use WSL and the Linux tty).

## Run

The default driver is the Icarus file bridge. A real tty is opt-in and was not used on a board:

```text
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/scp-uart-driver.ts --tty /dev/ttyUSB1
```

That writes the seed-9 two-frame prefix and reads one reply frame at 125000 baud (it stops at the uint16 length, or after 2 s). It does not claim the reply matched a golden model. The Icarus check is the bit-exact result:

```text
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0131.ts
```

## Receipt

Generate the key on the runner. Do not commit it.

```text
node -e 'const {ed25519}=require("@noble/curves/ed25519.js"); const {secretKey,publicKey}=ed25519.keygen(); console.log("PRIVATE", Buffer.from(secretKey).toString("hex")); console.log("PUBLIC", Buffer.from(publicKey).toString("hex"));'
```

Apply migration 007 only on a database that is not production Neon:

```text
psql "$NON_PRODUCTION_URL" -v ON_ERROR_STOP=1 -f db/migrations/007_shiyan_hw_receipts.sql
```

Then, with the public key on the server and the private key only in the runner shell:

```text
HW_RECEIPT_PRIVATE_KEY=<64 hex chars> npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/scp-hw-receipt.ts --submit http://127.0.0.1:3000/api/v1/hw/receipts
```

Server env: `HW_RECEIPT_PUBLIC_KEY`, `HW_RECEIPT_DATABASE_URL`. Codec env, unrelated to the board image: `SCP_CODEC` (default off) and `SHIYAN_STATE_COMPRESSION=1` for the reader.

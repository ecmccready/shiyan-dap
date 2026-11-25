# Versa board runbook

This has not been run on a board. Power is **needs real board**. No PHI. The private key is never committed.

Pins and the frame format are in `docs/hw/ecp5-versa-uart.md`. The part in the bitstream is LFE5UM-45F (`nextpnr-ecp5 --um-45k`), the device named in FPGA-EB-02021-2.4.

## Install

The pinned tools are OSS CAD Suite 20261118: Yosys 0.71+50 583f380c6, nextpnr-ecp5 0.11.1-103-ge811ba48, and the `ecppack` in that same tree.

```text
export PATH="/opt/eda/oss-cad-suite/bin:$PATH"
```

## Build

One command. It runs Yosys, then five 45F seeds one at a time (7,200 s bound is the harness limit; these routes are far under it), then `ecppack` for the median-Fmax seed.

```text
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/build-versa-bitstream.ts
```

Outputs, for the seed named in `fixtures/scp/versa-bitstream/summary.json`:

- `wrap_uart_versa-seed<N>.bit` and `.svf` (`ecppack --compress`)
- `wrap_uart_versa-seed<N>.spi.bit` (`ecppack --compress --spimode fast-read`)

The logic clock is 20 MHz from an EHXPLLL on the 100 MHz oscillator (`CLKI_DIV=1`, `CLKFB_DIV=4`, `CLKOP_DIV=20`). The UART divisor is 160, so the baud is exactly 125000. Do not open the port at 115200.

## Flash

Nothing in this repo was flashed. The guide's programming connector is J2 (USB-B). J3 is the alternate JTAG header and needs R38, R33, R32 and R36 removed (section 5.1).

SRAM, openFPGALoader board name `ecp5_evn` (the Versa is the ECP5 evaluation board that cable targets; confirm the cable enumerates before using it):

```text
openFPGALoader -b ecp5_evn fixtures/scp/versa-bitstream/wrap_uart_versa-seed<N>.bit
```

SPI flash, same cable, using the fast-read bitstream:

```text
openFPGALoader -b ecp5_evn -f fixtures/scp/versa-bitstream/wrap_uart_versa-seed<N>.spi.bit
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

That writes one framed prefix and reads the reply at 125000 baud. It does not claim the reply matched a golden model; the Icarus check is the bit-exact result.

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

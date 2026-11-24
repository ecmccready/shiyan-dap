/** File-bridge driver for the UART wrapper. Runs Icarus. Does not open a serial port
 * (serialport is not a dependency) and does not touch a board. Power is needs real board.
 *
 *   npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/scp-uart-driver.ts
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const OSS = process.env.OSS_CAD_SUITE ?? "/opt/eda/oss-cad-suite";

export function crc16(bytes: Uint8Array): number {
  let crc = 0xFFFF;
  for (const b of bytes) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
  }
  return crc & 0xFFFF;
}

export function runUartCosim(): { ok: boolean; text: string } {
  const env = { ...process.env, PATH: `${OSS}/bin:${process.env.PATH ?? ""}` };
  const files = [
    "hw/scp4d/rtl/scp4d_uart_ff.v",
    "hw/scp4d/rtl/scp4d_hybrid_ff.v",
    "hw/scp4d/rtl/scp4d_ede_coh.v",
    "hw/scp4d/rtl/scp4d_fsd_n_coh.v",
    "hw/scp4d/tb/scp4d_uart_ff_tb.v",
  ];
  const out = "/tmp/scp4d-uart-ff.vvp";
  const comp = spawnSync("iverilog", ["-g2012", "-o", out, ...files], { cwd: root, encoding: "utf8", env });
  if (comp.status !== 0) return { ok: false, text: `${comp.stdout ?? ""}\n${comp.stderr ?? ""}` };
  const run = spawnSync("vvp", [out], { cwd: root, encoding: "utf8", env });
  const text = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
  return { ok: run.status === 0 && text.includes("PASS uart-ff bit-exact"), text };
}

if (process.argv[1]?.endsWith("scp-uart-driver.ts")) {
  const r = runUartCosim();
  process.stdout.write(r.text);
  if (!r.ok) process.exitCode = 1;
}

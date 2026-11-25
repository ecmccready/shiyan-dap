/** File-bridge driver for the UART wrapper. Runs Icarus. Does not open a serial port
 * (serialport is not a dependency) and does not touch a board. Power is needs real board.
 *
 *   npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/scp-uart-driver.ts
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, openSync, readSync, writeFileSync, writeSync, closeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { mulberry32 } from "./scp-v012-fixtures";
import { freshEde, stepEde, stepFsd, type Tok } from "./scp-v0120-ede-model";

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

/** First `frames` frames of the existing held-out generator. Not a new fit. */
export function prefixTokens(seed: number, fraction: number, frames: number): Tok[] {
  const addrW = 8;
  const D = 256;
  const rng = mulberry32((Math.imul(seed, 10007) + addrW) >>> 0);
  const code = new Array<number>(D).fill(0);
  const tokens: Tok[] = [];
  const k = Math.max(1, Math.round(fraction * D));
  for (let frame = 0; frame < frames; frame++) {
    const idx = Array.from({ length: D }, (_, i) => i);
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(rng() * (D - i));
      const tmp = idx[i]!; idx[i] = idx[j]!; idx[j] = tmp;
    }
    const picked = idx.slice(0, k).sort((a, b) => a - b);
    const before = code.slice();
    for (const cell of picked) code[cell] = (rng() < 0.5 ? -1 : 1) * (2 + ((seed + frame + cell) % 5));
    const changed: number[] = [];
    for (let e = 0; e < D; e++) if (code[e] !== before[e]) changed.push(e);
    if (changed.length === 0) tokens.push({ elem: 0, code: 0, event: false, eof: true, last: frame === frames - 1 });
    else changed.forEach((elem, i) => tokens.push({
      elem, code: code[elem]!, event: true, eof: i === changed.length - 1, last: frame === frames - 1 && i === changed.length - 1,
    }));
  }
  return tokens;
}

export function uartFrame(tokens: readonly Tok[]): Uint8Array {
  const payload: number[] = [4];
  for (const t of tokens) {
    const c = t.code | 0;
    const flags = (t.event ? 1 : 0) | (t.eof ? 2 : 0) | (t.last ? 4 : 0);
    payload.push(t.elem & 255, c & 255, (c >>> 8) & 255, (c >>> 16) & 255, (c >>> 24) & 255, flags);
  }
  const p = Uint8Array.from(payload);
  const c = crc16(p);
  const out = new Uint8Array(5 + p.length);
  out[0] = 0xA5;
  out[1] = p.length & 255;
  out[2] = (p.length >>> 8) & 255;
  out.set(p, 3);
  out[3 + p.length] = c & 255;
  out[4 + p.length] = (c >>> 8) & 255;
  return out;
}

function softwareChanges(tokens: readonly Tok[]): string[] {
  const D = 256;
  const percent = 8;
  const frames: Tok[][] = [];
  let cur: Tok[] = [];
  for (const t of tokens) { cur.push(t); if (t.eof) { frames.push(cur); cur = []; } }
  const state = freshEde(D);
  const lines: string[] = [];
  let prevHi = false;
  for (const fr of frames) {
    const events = fr.filter((t) => t.event).length;
    const hi = events * 100 >= D * percent;
    const useFsd = hi;
    const run = useFsd ? stepFsd(state, D, 0, fr) : stepEde(state, D, 0, false, [], fr);
    for (const ch of run.changes) lines.push(`${ch.elem} ${ch.decision}`);
    prevHi = useFsd;
    void prevHi;
  }
  return lines;
}

export function runPrefix(seed: number, fraction: number, frames: number): { ok: boolean; text: string; tokens: number } {
  const tokens = prefixTokens(seed, fraction, frames);
  const dir = mkdtempSync(join(tmpdir(), "uart-ff-"));
  const stim = join(dir, "stim.bin");
  writeFileSync(stim, uartFrame(tokens));
  const env = { ...process.env, PATH: `${OSS}/bin:${process.env.PATH ?? ""}` };
  const files = [
    "hw/scp4d/rtl/scp4d_uart_ff.v",
    "hw/scp4d/rtl/scp4d_uart_ff_pipe.v",
    "hw/scp4d/rtl/scp4d_hybrid_ff.v",
    "hw/scp4d/rtl/scp4d_ede_coh.v",
    "hw/scp4d/rtl/scp4d_fsd_n_coh.v",
    "hw/scp4d/tb/scp4d_uart_file_tb.v",
  ];
  const out = join(dir, "t.vvp");
  const comp = spawnSync("iverilog", ["-g2012", "-o", out, ...files], { cwd: root, encoding: "utf8", env });
  if (comp.status !== 0) return { ok: false, text: `${comp.stdout ?? ""}\n${comp.stderr ?? ""}`, tokens: tokens.length };
  const run = spawnSync("vvp", [out, `+STIM=${stim}`], { cwd: root, encoding: "utf8", env });
  const text = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
  const soft = softwareChanges(tokens);
  const rec = text.split("\n").filter((l) => l.startsWith("REC ")).map((l) => l.slice(4));
  const same = rec.length === soft.length && rec.every((l, i) => l === soft[i]);
  const rtlPass = run.status === 0 && text.includes("PASS uart-file bit-exact");
  return { ok: rtlPass && same, text: text + `\nsoftware_match=${same} rtl_records=${rec.length} software_changes=${soft.length}\n`, tokens: tokens.length };
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

function ttySend(): void {
  const i = process.argv.indexOf("--tty");
  const path = process.argv[i + 1];
  if (!path) { console.error("usage: --tty <path>"); process.exitCode = 2; return; }
  const frame = uartFrame(prefixTokens(9, 0.01, 2));
  const stty = spawnSync("stty", ["-F", path, "125000", "cs8", "-cstopb", "-parenb", "raw", "-echo"], { encoding: "utf8" });
  if (stty.status !== 0) {
    console.error(stty.stderr || "stty could not set 125000 8N1");
    process.exitCode = 1;
    return;
  }
  const fd = openSync(path, "r+");
  try {
    writeSync(fd, frame);
    const buf = Buffer.alloc(64);
    const n = readSync(fd, buf, 0, buf.length, null);
    process.stdout.write(buf.subarray(0, n).toString("hex") + "\n");
  } finally { closeSync(fd); }
}

if (process.argv[1]?.endsWith("scp-uart-driver.ts")) {
  if (process.argv.includes("--tty")) ttySend();
  else {
    const r = runUartCosim();
    process.stdout.write(r.text);
    if (!r.ok) process.exitCode = 1;
  }
}

/** TEST ONLY. Icarus cycle counts for the v0.1.21 sweep.
 * Fmax and LUT are not produced here. Churn reuses a later place-and-route.
 * Power is needs real board.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/scp-v0121-sweep-cycles.ts
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { mulberry32 } from "./scp-v012-fixtures";
import { runEde, runFsd, type Tok } from "./scp-v0120-ede-model";

const root = resolve(join(import.meta.dirname, ".."));
const OUT = join(root, "fixtures/scp/v0121-sweep-cycles.json");
const ADDR = [8, 10, 12] as const;
const T = 64;
const CHURNS = [
  { id: "low", fraction: 0.01 },
  { id: "medium", fraction: 0.05 },
  { id: "high", fraction: 0.2 },
  { id: "very_high", fraction: 0.5 },
] as const;

function tokensFor(addrW: number, fraction: number, seed: number): Tok[] {
  const D = addrW >= 12 ? 2048 : 1 << addrW;
  const k = Math.max(1, Math.round(fraction * D));
  const rng = mulberry32((Math.imul(seed, 10007) + Math.round(fraction * 10000) + addrW) >>> 0);
  const code = new Array<number>(D).fill(0);
  const tokens: Tok[] = [];
  for (let t = 0; t < T; t++) {
    const idx = Array.from({ length: D }, (_, i) => i);
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(rng() * (D - i));
      const tmp = idx[i]!; idx[i] = idx[j]!; idx[j] = tmp;
    }
    const picked = idx.slice(0, k).sort((a, b) => a - b);
    for (const cell of picked) code[cell] = (rng() < 0.5 ? -1 : 1) * (2 + ((seed + t + cell) % 5));
    picked.forEach((cell, i) => tokens.push({
      elem: cell, code: code[cell]!, event: true,
      eof: i === picked.length - 1, last: t === T - 1 && i === picked.length - 1,
    }));
  }
  return tokens;
}

function stim(D: number, tokens: Tok[], changes: { frame: number; elem: number; decision: number }[]): string {
  const lines = [`${D} 0 0`, "0", String(tokens.length)];
  for (const t of tokens) lines.push(`${t.elem} ${t.code} ${t.event ? 1 : 0} ${t.eof ? 1 : 0} ${t.last ? 1 : 0}`);
  lines.push(String(changes.length));
  for (const c of changes) lines.push(`${c.frame} ${c.elem} ${c.decision}`);
  lines.push("0");
  return `${lines.join("\n")}\n`;
}

const dir = mkdtempSync(join(tmpdir(), "v0121-sweep-"));
const rows: unknown[] = [];
for (const addrW of ADDR) {
  const D = addrW >= 12 ? 2048 : 1 << addrW;
  const bin = join(dir, `a${addrW}.vvp`);
  const comp = spawnSync("iverilog", ["-g2012", `-Pscp4d_ede_tb.ADDR_W=${addrW}`, "-o", bin,
    join(root, "hw/scp4d/tb/scp4d_ede_tb.v"),
    join(root, "hw/scp4d/rtl/scp4d_ede.v"),
    join(root, "hw/scp4d/rtl/scp4d_fsd.v")], { encoding: "utf8" });
  if (comp.status !== 0) {
    console.error(comp.stderr);
    process.exit(1);
  }
  for (const churn of CHURNS) {
    const tokens = tokensFor(addrW, churn.fraction, 1);
    const ede = runEde(D, 0, false, [], tokens);
    const fsd = runFsd(D, 0, tokens);
    for (const [dut, model] of [["ede", ede], ["fsd", fsd]] as const) {
      const file = join(dir, `${addrW}-${churn.id}-${dut}.txt`);
      writeFileSync(file, stim(D, tokens, model.changes));
      const started = process.hrtime.bigint();
      const r = spawnSync("vvp", ["-n", bin, `+stim=${file}`, `+dut=${dut === "ede" ? 0 : 1}`], { encoding: "utf8" });
      const seconds = Number(process.hrtime.bigint() - started) / 1e9;
      const line = (r.stdout ?? "").split("\n").find((l) => l.startsWith("RESULT ")) ?? "";
      const num = (k: string) => Number(line.match(new RegExp(`${k}=(-?\\d+)`))?.[1]);
      const ok = num("ok") === 1 && num("cycles") === model.cycles && num("evals") === model.evals;
      if (!ok) {
        console.error("SIM FAIL", addrW, churn.id, dut, line || r.stderr.slice(-200));
        process.exit(1);
      }
      rows.push({
        addr_w: addrW, D, churn: churn.id, fraction: churn.fraction, arm: dut,
        cycles: model.cycles, evals: model.evals, changes: model.changes.length,
        icarus_s: Number(seconds.toFixed(3)),
      });
      console.log(`ok A=${addrW} ${churn.id} ${dut} cycles=${model.cycles} evals=${model.evals} ${seconds.toFixed(1)}s`);
    }
  }
}
const hashed = [
  "hw/scp4d/rtl/scp4d_ede.v",
  "hw/scp4d/rtl/scp4d_fsd.v",
  "hw/scp4d/tb/scp4d_ede_tb.v",
  "scripts/scp-v0120-ede-model.ts",
  "scripts/scp-v0121-sweep-cycles.ts",
];
const iverilog = spawnSync("iverilog", ["-V"], { encoding: "utf8" });
const iverilogLine = `${iverilog.stdout ?? ""}\n${iverilog.stderr ?? ""}`.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
writeFileSync(OUT, `${JSON.stringify({
  format: "scp4d-v0121-sweep-cycles",
  label: "Icarus cycle counts only. Fmax is not in this file. Power is needs real board. Churn reuses one place-and-route per ADDR_W.",
  T, threshold: 0, predictor: "last", relations: false,
  tools: { iverilog: iverilogLine },
  hashes: Object.fromEntries(hashed.map((p) => [p, createHash("sha256").update(readFileSync(join(root, p))).digest("hex")])),
  rows,
}, null, 2)}\n`);
console.log("wrote", OUT);

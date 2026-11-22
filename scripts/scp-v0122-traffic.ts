/** TEST ONLY. Icarus counts of K1 queue and memory operations.
 * Pre-BRAM RTL is taken from git (ede a6bb68f6^, tap 0a3f7df5^) into a temp dir.
 * Does not place-and-route. Power is needs real board.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/scp-v0122-traffic.ts
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { envTemporalStreams } from "./scp-v0111-rtl-vectors";
import { runEde, runFsd, type Tok } from "./scp-v0120-ede-model";
import { mulberry32 } from "./scp-v012-fixtures";

const root = resolve(join(import.meta.dirname, ".."));
const PRE_EDE = "a6bb68f6";
const PRE_TAP = "0a3f7df5";

function gitShow(rev: string, path: string): string {
  const r = spawnSync("git", ["show", `${rev}:${path}`], { cwd: root, encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout;
}

function tokensEnv(): Tok[] {
  const env = envTemporalStreams().find((s) => s.id === "env-16x16x2-T64-temporal-last")!;
  const tokens: Tok[] = [];
  env.perFrame.forEach((frame, t) => {
    const cells = frame.positions;
    if (cells.length === 0) tokens.push({ elem: 0, code: 0, event: false, eof: true, last: t === env.perFrame.length - 1 });
    else cells.forEach((elem, i) => tokens.push({
      elem, code: env.codes[t]![elem]!, event: true,
      eof: i === cells.length - 1, last: t === env.perFrame.length - 1 && i === cells.length - 1,
    }));
  });
  return tokens;
}

function tokensChurn(addrW: number, fraction: number): Tok[] {
  const D = addrW >= 12 ? 2048 : 1 << addrW;
  const k = Math.max(1, Math.round(fraction * D));
  const rng = mulberry32((Math.imul(1, 10007) + Math.round(fraction * 10000) + addrW) >>> 0);
  const code = new Array<number>(D).fill(0);
  const tokens: Tok[] = [];
  for (let t = 0; t < 64; t++) {
    const idx = Array.from({ length: D }, (_, i) => i);
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(rng() * (D - i));
      const tmp = idx[i]!; idx[i] = idx[j]!; idx[j] = tmp;
    }
    const picked = idx.slice(0, k).sort((a, b) => a - b);
    for (const cell of picked) code[cell] = (rng() < 0.5 ? -1 : 1) * (2 + ((1 + t + cell) % 5));
    picked.forEach((cell, i) => tokens.push({
      elem: cell, code: code[cell]!, event: true,
      eof: i === picked.length - 1, last: t === 63 && i === picked.length - 1,
    }));
  }
  return tokens;
}

function stim(D: number, tokens: Tok[]): string {
  const lines = [`${D} 0 0`, "0", String(tokens.length)];
  for (const t of tokens) lines.push(`${t.elem} ${t.code} ${t.event ? 1 : 0} ${t.eof ? 1 : 0} ${t.last ? 1 : 0}`);
  return lines.join("\n") + "\n";
}

function compile(dir: string, name: string, addr: number, sources: string[]): string {
  const bin = join(dir, name);
  const r = spawnSync("iverilog", ["-g2012", `-Pscp4d_k1_traffic_tb.ADDR_W=${addr}`, "-o", bin, ...sources], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr);
  return bin;
}

function run(bin: string, file: string, dut: number): Record<string, number> {
  const r = spawnSync("vvp", ["-n", bin, `+stim=${file}`, `+dut=${dut}`], { encoding: "utf8" });
  const line = (r.stdout ?? "").split("\n").find((l) => l.startsWith("RESULT ")) ?? "";
  if (!line) throw new Error(r.stderr || r.stdout);
  const out: Record<string, number> = {};
  for (const part of line.slice(7).split(" ")) {
    const [k, v] = part.split("=");
    if (k && v && /^-?\d+$/.test(v)) out[k] = Number(v);
  }
  return out;
}

const dir = mkdtempSync(join(tmpdir(), "k1-traffic-"));
const edeNow = join(root, "hw/scp4d/rtl/scp4d_ede.v");
const fsdNow = join(root, "hw/scp4d/rtl/scp4d_fsd.v");
const tb = join(root, "hw/scp4d/tb/scp4d_k1_traffic_tb.v");
writeFileSync(join(dir, "ede-pre.v"), gitShow(`${PRE_EDE}^`, "hw/scp4d/rtl/scp4d_ede.v"));
writeFileSync(join(dir, "fsd-pre.v"), gitShow(`${PRE_EDE}^`, "hw/scp4d/rtl/scp4d_fsd.v"));

const streams: { id: string; addr: number; D: number; tokens: Tok[] }[] = [
  { id: "env-T64", addr: 11, D: 2048, tokens: tokensEnv() },
  { id: "sweep-a12-low", addr: 12, D: 2048, tokens: tokensChurn(12, 0.01) },
  { id: "sweep-a12-very-high", addr: 12, D: 2048, tokens: tokensChurn(12, 0.5) },
];

const rows: unknown[] = [];
for (const s of streams) {
  const file = join(dir, `${s.id}.txt`);
  writeFileSync(file, stim(s.D, s.tokens));
  const modelE = runEde(s.D, 0, false, [], s.tokens);
  const modelF = runFsd(s.D, 0, s.tokens);
  const now = compile(dir, `now-${s.addr}.vvp`, s.addr, [tb, edeNow, fsdNow]);
  const pre = compile(dir, `pre-${s.addr}.vvp`, s.addr, [tb, join(dir, "ede-pre.v"), join(dir, "fsd-pre.v")]);
  const edeB = run(now, file, 0);
  const fsdB = run(now, file, 1);
  const edeP = run(pre, file, 0);
  const fsdP = run(pre, file, 1);
  if (edeB.cycles !== modelE.cycles || edeB.evals !== modelE.evals) {
    throw new Error(`BRAM ede ${s.id} icarus ${edeB.cycles}/${edeB.evals} model ${modelE.cycles}/${modelE.evals}`);
  }
  if (fsdB.cycles !== modelF.cycles || fsdB.evals !== modelF.evals) {
    throw new Error(`BRAM fsd ${s.id} icarus ${fsdB.cycles}/${fsdB.evals} model ${modelF.cycles}/${modelF.evals}`);
  }
  // Histogram keys are the FSM state numbers. Queue push/pop come from head/tail.
  // Pre-BRAM ede: CLEAR, IDLE, FAN, EVAL, EOF. BRAM ede: CLEAR, IDLE, IN_WAIT, IN_USE, FAN_*, EV_*.
  // Pre-BRAM fsd: CLEAR, IDLE, SCAN, EOF. BRAM fsd: CLEAR, IDLE, WAIT, SCAN, EOF.
  const interpret = (kind: "pre" | "bram", dut: "ede" | "fsd", h: Record<string, number>, events: number) => {
    if (dut === "fsd") {
      const scanReads = h.h2 ?? 0;
      const scanWrites = kind === "bram" ? (h.h3 ?? 0) : (h.h2 ?? 0);
      return {
        queue_pushes: 0, queue_pops: 0,
        dirty_reads: 0, dirty_writes: 0,
        decision_reads: scanReads,
        decision_writes: (h.h0 ?? 0) + scanWrites,
        state_reads: scanReads,
        state_writes: (h.h0 ?? 0) + events,
      };
    }
    if (kind === "bram") {
      return {
        queue_pushes: h.pushes, queue_pops: h.pops,
        dirty_reads: (h.h2 ?? 0) + (h.h8 ?? 0),
        dirty_writes: (h.h0 ?? 0) + h.pushes + h.pops,
        decision_reads: h.h8 ?? 0,
        decision_writes: (h.h0 ?? 0) + (h.h9 ?? 0),
        state_reads: (h.h2 ?? 0) + (h.h8 ?? 0),
        state_writes: (h.h0 ?? 0) + (h.h3 ?? 0),
      };
    }
    return {
      queue_pushes: h.pushes, queue_pops: h.pops,
      dirty_reads: h.pushes,
      dirty_writes: (h.h0 ?? 0) + h.pushes + h.pops,
      decision_reads: h.pops,
      decision_writes: (h.h0 ?? 0) + h.pops,
      state_reads: h.pops,
      state_writes: (h.h0 ?? 0) + h.pushes,
    };
  };
  rows.push({
    id: s.id, D: s.D,
    bram_ede: { ...edeB, ops: interpret("bram", "ede", edeB, edeB.pushes ?? 0) },
    pre_ede: { ...edeP, ops: interpret("pre", "ede", edeP, edeP.pushes ?? 0) },
    bram_fsd: { ...fsdB, ops: interpret("bram", "fsd", fsdB, edeB.pushes ?? 0) },
    pre_fsd: { ...fsdP, ops: interpret("pre", "fsd", fsdP, edeP.pushes ?? 0) },
  });
  console.log("ok", s.id, "ede", edeP.cycles, "->", edeB.cycles, "pushes", edeP.pushes, "->", edeB.pushes);
}

writeFileSync(join(root, "fixtures/scp/v0122-traffic.json"), JSON.stringify({
  format: "scp4d-v0122-traffic",
  label: "Icarus FSM counts. Pre-BRAM ede/fsd are git a6bb68f6^. The k1_tap queue still pushes one beat per decoder token; block RAM changed where those beats sit, not how many there are. Power is needs real board.",
  pre_ede_rev: `${PRE_EDE}^`,
  pre_tap_rev: `${PRE_TAP}^`,
  tap: "Push count is unchanged by the block-RAM queue. The v0.1.21 pipe still delivers the same 27590 evals.",
  rows,
}, null, 2) + "\n");
console.log("wrote fixtures/scp/v0122-traffic.json");

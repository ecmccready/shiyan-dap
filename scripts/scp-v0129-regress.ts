/** TEST ONLY. Synthetic switch traces for scp4d_hybrid_coh. Not seed 9 or seed 13.
 * Includes the v0.1.28 trace that drops element 0 on scp4d_hybrid_n.
 * Power is needs real board.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/scp-v0129-regress.ts
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { freshEde, stepEde, stepFsd, type Change, type Tok } from "./scp-v0120-ede-model";

const root = resolve(join(import.meta.dirname, ".."));

function frame(pairs: readonly (readonly [number, number])[], last: boolean): Tok[] {
  return pairs.map(([elem, code], i) => ({
    elem, code, event: true, eof: i === pairs.length - 1, last: last && i === pairs.length - 1,
  }));
}
const span = (n: number, code: number) => Array.from({ length: n }, (_, e) => [e, code] as const);

function golden(frames: Tok[][], D: number, percent: number, hold: number, startFsd: boolean): { want: string[]; sels: boolean[] } {
  let useFsd = startFsd;
  let prevHi = startFsd;
  const state = freshEde(D);
  const want: Change[] = [];
  const sels: boolean[] = [];
  for (const [i, one] of frames.entries()) {
    sels.push(useFsd);
    const step = useFsd ? stepFsd(state, D, 0, one) : stepEde(state, D, 0, false, [], one);
    for (const c of step.changes) want.push({ ...c, frame: i });
    const hi = one.filter((t) => t.event).length * 100 >= D * percent;
    const voteFsd = hold <= 1 ? hi : hi && prevHi;
    const voteK1 = hold <= 1 ? !hi : !hi && !prevHi;
    if (!useFsd && voteFsd) useFsd = true;
    else if (useFsd && voteK1) useFsd = false;
    prevHi = hi;
  }
  return { want: want.map((c) => `${c.frame}:${c.elem}:${c.decision}`).sort(), sels };
}

function split(tokens: Tok[]): Tok[][] {
  const frames: Tok[][] = [];
  let cur: Tok[] = [];
  for (const t of tokens) {
    cur.push(t);
    if (t.eof) { frames.push(cur); cur = []; }
  }
  return frames;
}

const cases: { name: string; D: number; percent: number; hold: number; start: number; tokens: Tok[] }[] = [
  {
    name: "v0128-drop",
    D: 32, percent: 55, hold: 1, start: 0,
    tokens: [
      ...frame([[5, 2], [6, 2]], false),
      ...frame(span(20, 3), false),
      ...frame([[5, -2], [6, -2]], false),
      ...frame(span(20, -4), false),
      ...frame([[5, 2], [6, 2]], false),
      ...frame(span(20, 4), true),
    ],
  },
  {
    name: "switch-heavy",
    D: 32, percent: 20, hold: 1, start: 0,
    tokens: [
      ...frame([[1, 2]], false),
      ...frame(span(16, 3), false),
      ...frame([[2, -2]], false),
      ...frame(span(16, -3), false),
      ...frame([[3, 4]], false),
      ...frame(span(16, 5), false),
      ...frame([[4, -4]], true),
    ],
  },
  {
    name: "hold2-start-fsd",
    D: 32, percent: 40, hold: 2, start: 1,
    tokens: [
      ...frame(span(20, 2), false),
      ...frame([[1, -2]], false),
      ...frame(span(18, 3), false),
      ...frame(span(18, -3), false),
      ...frame([[2, 2], [3, 2]], true),
    ],
  },
];

const dir = mkdtempSync(join(tmpdir(), "scp4d-v0129r-"));
let failed = false;
for (const c of cases) {
  const frames = split(c.tokens);
  const g = golden(frames, c.D, c.percent, c.hold, c.start === 1);
  const tokPath = join(dir, `${c.name}.txt`);
  writeFileSync(tokPath, c.tokens.map((t) => `${t.elem} ${t.code} ${t.event ? 1 : 0} ${t.eof ? 1 : 0} ${t.last ? 1 : 0}`).join("\n") + "\n");
  const sources = [
    "hw/scp4d/tb/scp4d_hybrid_handoff_tb.v",
    "hw/scp4d/rtl/scp4d_hybrid_coh.v",
    "hw/scp4d/rtl/scp4d_ede_coh.v",
    "hw/scp4d/rtl/scp4d_fsd_n_coh.v",
  ].map((p) => join(root, p));
  const out = join(dir, `${c.name}.vvp`);
  const comp = spawnSync("iverilog", ["-g2012",
    "-Pscp4d_hybrid_handoff_tb.OLD=2",
    `-Pscp4d_hybrid_handoff_tb.PERCENT=${c.percent}`,
    `-Pscp4d_hybrid_handoff_tb.HOLD=${c.hold}`,
    `-Pscp4d_hybrid_handoff_tb.START_FSD=${c.start}`,
    "-o", out, ...sources,
  ], { encoding: "utf8" });
  if (comp.status !== 0) { console.error(c.name, comp.stderr.slice(-800)); failed = true; continue; }
  const sim = spawnSync("vvp", ["-n", out, `+tokens=${tokPath}`, `+D=${c.D}`], { encoding: "utf8" });
  const lines = (sim.stdout ?? "").split("\n");
  const got = lines.filter((l) => l.startsWith("CHG ")).map((l) => l.slice(4).trim().split(/\s+/).join(":")).sort();
  const fr = lines.filter((l) => l.startsWith("FRAME ")).map((l) => l.trim().split(/\s+/));
  const selOk = fr.length === frames.length && fr.every((p, i) => (p[2] === "1") === g.sels[i]);
  const same = got.length === g.want.length && got.every((k, i) => k === g.want[i]);
  const ok = /ok=1/.test(lines.find((l) => l.startsWith("TOTAL ")) ?? "") && same && selOk;
  if (!ok) {
    failed = true;
    const missing = g.want.filter((k) => !got.includes(k)).slice(0, 8);
    const extra = got.filter((k) => !g.want.includes(k)).slice(0, 8);
    console.error(`${c.name} FAIL sel ${fr.map((p) => p[2]).join("")} want ${g.sels.map((s) => s ? "1" : "0").join("")} missing ${missing.join(" ")} extra ${extra.join(" ")}`);
  } else console.log(`${c.name} exact sels ${g.sels.map((s) => (s ? "1" : "0")).join("")}`);
}
if (failed) { console.error("REGRESS FAIL"); process.exit(1); }
console.log("REGRESS PASS");

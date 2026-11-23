/** TEST ONLY. First-frame buffer traces. Not seed 9 or seed 13.
 * Includes the v0.1.28 dropped-record trace. Power is needs real board.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/scp-v0130-regress.ts
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
function split(tokens: Tok[]): Tok[][] {
  const frames: Tok[][] = [];
  let cur: Tok[] = [];
  for (const t of tokens) { cur.push(t); if (t.eof) { frames.push(cur); cur = []; } }
  return frames;
}
function golden(frames: Tok[][], D: number, percent: number, hold: number) {
  let useFsd = false;
  let prevHi = false;
  let armed = false;
  const state = freshEde(D);
  const want: Change[] = [];
  const sels: boolean[] = [];
  for (const [i, one] of frames.entries()) {
    const events = one.filter((t) => t.event).length;
    const hi = events * 100 >= D * percent;
    if (!armed) { useFsd = hi; prevHi = hi; armed = true; }
    sels.push(useFsd);
    const step = useFsd ? stepFsd(state, D, 0, one) : stepEde(state, D, 0, false, [], one);
    for (const c of step.changes) want.push({ ...c, frame: i });
    const voteFsd = hold <= 1 ? hi : hi && prevHi;
    const voteK1 = hold <= 1 ? !hi : !hi && !prevHi;
    if (!useFsd && voteFsd) useFsd = true;
    else if (useFsd && voteK1) useFsd = false;
    prevHi = hi;
  }
  return { want: want.map((c) => `${c.frame}:${c.elem}:${c.decision}`).sort(), sels };
}

const cases = [
  { name: "v0128-drop", D: 32, percent: 55, hold: 1, tokens: [
    ...frame([[5, 2], [6, 2]], false), ...frame(span(20, 3), false), ...frame([[5, -2], [6, -2]], false),
    ...frame(span(20, -4), false), ...frame([[5, 2], [6, 2]], false), ...frame(span(20, 4), true),
  ]},
  { name: "switch-heavy", D: 32, percent: 20, hold: 1, tokens: [
    ...frame([[1, 2]], false), ...frame(span(16, 3), false), ...frame([[2, -2]], false),
    ...frame(span(16, -3), false), ...frame([[3, 4]], false), ...frame(span(16, 5), false), ...frame([[4, -4]], true),
  ]},
  { name: "first-high", D: 32, percent: 40, hold: 1, tokens: [
    ...frame(span(20, 3), false), ...frame([[1, -2]], false), ...frame(span(16, 4), true),
  ]},
  { name: "first-low", D: 32, percent: 40, hold: 1, tokens: [
    ...frame([[1, 2], [2, 2]], false), ...frame(span(20, 3), false), ...frame([[3, -3]], true),
  ]},
];

const dir = mkdtempSync(join(tmpdir(), "scp4d-v0130r-"));
let failed = false;
for (const c of cases) {
  const frames = split(c.tokens);
  const g = golden(frames, c.D, c.percent, c.hold);
  const tokPath = join(dir, `${c.name}.txt`);
  writeFileSync(tokPath, c.tokens.map((t) => `${t.elem} ${t.code} ${t.event ? 1 : 0} ${t.eof ? 1 : 0} ${t.last ? 1 : 0}`).join("\n") + "\n");
  const sources = [
    "hw/scp4d/tb/scp4d_hybrid_handoff_tb.v",
    "hw/scp4d/rtl/scp4d_hybrid_ff.v", "hw/scp4d/rtl/scp4d_ede_coh.v", "hw/scp4d/rtl/scp4d_fsd_n_coh.v",
  ].map((p) => join(root, p));
  const out = join(dir, `${c.name}.vvp`);
  const comp = spawnSync("iverilog", ["-g2012", "-Pscp4d_hybrid_handoff_tb.OLD=3",
    `-Pscp4d_hybrid_handoff_tb.PERCENT=${c.percent}`, `-Pscp4d_hybrid_handoff_tb.HOLD=${c.hold}`,
    "-o", out, ...sources], { encoding: "utf8" });
  if (comp.status !== 0) { console.error(c.name, comp.stderr.slice(-600)); failed = true; continue; }
  const sim = spawnSync("vvp", ["-n", out, `+tokens=${tokPath}`, `+D=${c.D}`], { encoding: "utf8" });
  const lines = (sim.stdout ?? "").split("\n");
  const got = lines.filter((l) => l.startsWith("CHG ")).map((l) => l.slice(4).trim().split(/\s+/).join(":")).sort();
  const fr = lines.filter((l) => l.startsWith("FRAME ")).map((l) => l.trim().split(/\s+/));
  const selOk = fr.length === frames.length && fr.every((p, i) => (p[2] === "1") === g.sels[i]);
  const same = got.length === g.want.length && got.every((k, i) => k === g.want[i]);
  const ok = /ok=1/.test(lines.find((l) => l.startsWith("TOTAL ")) ?? "") && same && selOk;
  if (!ok) {
    failed = true;
    console.error(`${c.name} FAIL sel ${fr.map((p) => p[2]).join("")} want ${g.sels.map((s) => s ? "1" : "0").join("")} missing ${g.want.filter((k) => !got.includes(k)).slice(0, 6).join(" ")} extra ${got.filter((k) => !g.want.includes(k)).slice(0, 6).join(" ")}`);
    console.error((sim.stdout ?? "").split("\n").filter((l) => l.startsWith("TOTAL") || l.startsWith("FRAME")).join("\n"));
  } else console.log(`${c.name} exact ${g.sels.map((s) => s ? "1" : "0").join("")}`);
}
console.log(failed ? "REGRESS FAIL" : "REGRESS PASS");
process.exit(failed ? 1 : 0);

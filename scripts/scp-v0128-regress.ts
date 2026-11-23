/** TEST ONLY. Synthetic fsd->K1 handoff. Not seed 9 and not seed 13.
 * The old module must drop a decision. The fixed module must match.
 * Power is needs real board.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/scp-v0128-regress.ts
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { freshEde, stepEde, stepFsd, type Change, type Tok } from "./scp-v0120-ede-model";

const root = resolve(join(import.meta.dirname, ".."));
const D = 32;
const PERCENT = 55;

function frame(pairs: readonly (readonly [number, number])[], last: boolean): Tok[] {
  return pairs.map(([elem, code], i) => ({
    elem, code, event: true, eof: i === pairs.length - 1, last: last && i === pairs.length - 1,
  }));
}

const high = (code: number): (readonly [number, number])[] =>
  Array.from({ length: 20 }, (_, e) => [e, code] as const);
const tokens: Tok[] = [
  ...frame([[5, 2], [6, 2]], false),
  ...frame(high(3), false),
  ...frame([[5, -2], [6, -2]], false),
  ...frame(high(-4), false),
  ...frame([[5, 2], [6, 2]], false),
  ...frame(high(4), true),
];

const frames: Tok[][] = [];
{
  let cur: Tok[] = [];
  for (const t of tokens) {
    cur.push(t);
    if (t.eof) { frames.push(cur); cur = []; }
  }
}

let useFsd = false;
const want: Change[] = [];
const sels: boolean[] = [];
const state = freshEde(D);
for (const [i, one] of frames.entries()) {
  sels.push(useFsd);
  const step = useFsd ? stepFsd(state, D, 0, one) : stepEde(state, D, 0, false, [], one);
  for (const c of step.changes) want.push({ ...c, frame: i });
  const events = one.filter((t) => t.event).length;
  useFsd = events * 100 >= D * PERCENT;
}

const dir = mkdtempSync(join(tmpdir(), "scp4d-v0128r-"));
const tokPath = join(dir, "tok.txt");
writeFileSync(tokPath, tokens.map((t) => `${t.elem} ${t.code} ${t.event ? 1 : 0} ${t.eof ? 1 : 0} ${t.last ? 1 : 0}`).join("\n") + "\n");

function run(old: boolean): { got: string[]; frames: string[][]; ok: boolean } {
  const sources = [
    "hw/scp4d/tb/scp4d_hybrid_handoff_tb.v",
    old ? "hw/scp4d/rtl/scp4d_hybrid_n.v" : "hw/scp4d/rtl/scp4d_hybrid_fix.v",
    "hw/scp4d/rtl/scp4d_ede_pipe.v",
    "hw/scp4d/rtl/scp4d_fsd_n.v",
  ].map((p) => join(root, p));
  const out = join(dir, old ? "old.vvp" : "new.vvp");
  const defs = [
    "-g2012",
    `-Pscp4d_hybrid_handoff_tb.OLD=${old ? 1 : 0}`,
    `-Pscp4d_hybrid_handoff_tb.PERCENT=${PERCENT}`,
    "-o", out, ...sources,
  ];
  const comp = spawnSync("iverilog", defs, { encoding: "utf8" });
  if (comp.status !== 0) {
    console.error(comp.stderr);
    process.exit(1);
  }
  const sim = spawnSync("vvp", ["-n", out, `+tokens=${tokPath}`, `+D=${D}`], { encoding: "utf8" });
  const lines = (sim.stdout ?? "").split("\n");
  const got = lines.filter((l) => l.startsWith("CHG ")).map((l) => l.slice(4).trim().split(/\s+/).join(":"));
  const fr = lines.filter((l) => l.startsWith("FRAME ")).map((l) => l.trim().split(/\s+/));
  const total = lines.find((l) => l.startsWith("TOTAL ")) ?? "";
  return { got: got.sort(), frames: fr, ok: /ok=1/.test(total) };
}

const wantKeys = want.map((c) => `${c.frame}:${c.elem}:${c.decision}`).sort();
const oldRun = run(true);
const newRun = run(false);
const same = (a: string[], b: string[]) => a.length === b.length && a.every((k, i) => k === b[i]);
const oldExact = same(oldRun.got, wantKeys);
const newExact = same(newRun.got, wantKeys) && newRun.ok && newRun.frames.length === frames.length
  && newRun.frames.every((p, i) => (p[2] === "1") === sels[i]);
const missing = wantKeys.filter((k) => !oldRun.got.includes(k));
console.log(`old exact ${oldExact} missing ${missing.join(" ") || "none"}`);
console.log(`new exact ${newExact} frames ${newRun.frames.map((p) => p[2]).join("")}`);
if (oldExact || !newExact) {
  console.error("REGRESS FAIL");
  if (!newExact) {
    const miss = wantKeys.filter((k) => !newRun.got.includes(k)).slice(0, 12);
    const extra = newRun.got.filter((k) => !wantKeys.includes(k)).slice(0, 12);
    console.error(" new missing", miss.join(" "), " extra", extra.join(" "));
  }
  process.exit(1);
}
console.log("REGRESS PASS");

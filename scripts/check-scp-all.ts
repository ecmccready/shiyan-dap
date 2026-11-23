/** TEST ONLY. Runs every 4D-SCP check in order and reports each one's check count.
 * No network, no writes, no env reads. Each check runs in its own child process so a failure
 * in one cannot mask another. Fails (exit 1) if any check exits non-zero, if a check prints a
 * different count than the pinned one below, or if a check is missing.
 *
 * The pinned counts are the zero-break contract: adding checks to an existing script must update
 * EXPECTED here in the same commit, with a reason in the commit message.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-all.ts
 *      (add --only=check-scp-v01,check-scp-v019-bench to run a subset)
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(join(import.meta.dirname, ".."));

/** name → pinned check count; null = the script prints PASS lines but no "(N checks)" total. */
export const EXPECTED: ReadonlyArray<readonly [string, number | null]> = [
  ["check-scp-boundary", null],
  ["check-scp-v01", 25],
  ["check-scp-v011", 28],
  ["check-scp-v012", 61],
  ["check-scp-v013", 79],
  ["check-scp-v014", 104],
  ["check-scp-v015", 77],
  ["check-scp-v016", 67],
  ["check-scp-v017", 75],
  ["check-scp-v018", 104],
  ["check-scp-v019-bench", 71],
  ["check-scp-v0110", 101],
  ["check-scp-v0111-rtl", 33],
  ["check-scp-v0112-rtl", 27],
  ["check-scp-v0113-rtl", 27],
  ["check-scp-v0114-rtl", 19],
  ["check-scp-v0115-rtl", 20],
  ["check-scp-v0116-rtl", 22],
  ["check-scp-v0117-rtl", 22],
  ["check-scp-v0118-rtl", 24],
  ["check-scp-v0120", 23],
  ["check-scp-v0120-rtl", 12],
  ["check-scp-v0121-hashes", 7],
  ["check-scp-v0122-rtl", 4],
  ["check-scp-v0123-rtl", 4],
  ["check-scp-v0123b-loop", 3],
  ["check-scp-v0124", 8],
  ["check-scp-v0125", 8],
  ["check-scp-v0126", 8],
  ["check-scp-v0127", 8],
  ["check-scp-v0128", 9],
  ["check-scp-v0129", 9],
];

const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const only = onlyArg ? new Set(onlyArg.slice("--only=".length).split(",").filter(Boolean)) : null;

type Row = { name: string; exit: number | null; expected: number | null; got: number | null; ok: boolean; seconds: number };
const rows: Row[] = [];
for (const [name, expected] of EXPECTED) {
  if (only && !only.has(name)) continue;
  const file = join("scripts", `${name}.ts`);
  if (!existsSync(join(root, file))) {
    rows.push({ name, exit: null, expected, got: null, ok: false, seconds: 0 });
    continue;
  }
  const started = process.hrtime.bigint();
  const r = spawnSync("npx", ["--yes", "tsx@4", "--tsconfig", "./tsconfig.json", file], {
    cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
  });
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const m = out.match(new RegExp(`PASS ${name} \\((\\d+) checks\\)`));
  const got = m ? Number(m[1]) : null;
  const passLine = new RegExp(`^PASS ${name}\\b`, "m").test(out);
  const ok = r.status === 0 && passLine && got === expected;
  if (!ok) process.stderr.write(`--- ${name} output (tail) ---\n${out.split("\n").slice(-25).join("\n")}\n`);
  rows.push({ name, exit: r.status, expected, got, ok, seconds });
}

const pad = (s: string, n: number) => s.padEnd(n);
console.log(`${pad("check", 22)} ${pad("exit", 5)} ${pad("expected", 9)} ${pad("got", 6)} ${pad("time", 8)} result`);
for (const r of rows) {
  console.log(`${pad(r.name, 22)} ${pad(String(r.exit), 5)} ${pad(r.expected === null ? "PASS" : String(r.expected), 9)} ${pad(r.got === null ? (r.ok ? "PASS" : "-") : String(r.got), 6)} ${pad(`${r.seconds.toFixed(1)}s`, 8)} ${r.ok ? "PASS" : "FAIL"}`);
}
const failed = rows.filter((r) => !r.ok);
const total = rows.reduce((s, r) => s + (r.got ?? 0), 0);
if (failed.length || rows.length === 0) {
  console.error(`FAIL check-scp-all (${failed.length} of ${rows.length} failed: ${failed.map((r) => r.name).join(", ")})`);
  process.exit(1);
}
console.log(`PASS check-scp-all (${rows.length} scripts, ${total} counted checks; timings are reported, not asserted)`);

// Run: npx tsx scripts/validate-view-surfaces.ts <file.json>
// Operator tool: reads ONE local JSON file (a pasted "Copy view surfaces JSON" pack, aethel.view_surfaces.v1) and runs validateViewSurfaces.
// No network, no fetching, no URL handling, writes no files. A pass means well-formed only, not verified or trusted.
// Exit codes: 0 well-formed (warnings allowed), 1 not well-formed or invalid JSON, 2 usage or file problem.
import { readFileSync, statSync } from "node:fs";
import { validateViewSurfaces, VIEW_SURFACES_SCHEMA } from "../src/lib/marketplace/peers";

const MAX_BYTES = 5 * 1024 * 1024;
const USAGE = "Usage: npx tsx scripts/validate-view-surfaces.ts <file.json>   (exactly one local file; no network, no writes)";

function main(args: string[]): number {
  if (args.length !== 1) { console.error(USAGE); return 2; }
  const file = args[0];
  let text: string;
  try {
    const st = statSync(file);
    if (!st.isFile()) { console.error(`error: ${file} is not a regular file`); return 2; }
    if (st.size > MAX_BYTES) { console.error(`error: ${file} is ${st.size} bytes; the limit is ${MAX_BYTES} bytes (5 MB)`); return 2; }
    text = readFileSync(file, "utf8");
  } catch (e) {
    console.error(`error: cannot read ${file}: ${e instanceof Error ? e.message : "unknown error"}`);
    return 2;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    console.error(`error: ${file} is not valid JSON: ${e instanceof Error ? e.message : "parse error"}`);
    return 1;
  }
  const r = validateViewSurfaces(parsed);
  console.log(`${VIEW_SURFACES_SCHEMA} shape check (well-formed only; not verified or trusted)`);
  for (const e of r.errors) console.log(`error: ${e}`);
  for (const w of r.warnings) console.log(`warning: ${w}`);
  console.log(r.ok ? `OK: view surfaces well-formed (${r.warnings.length} warning(s))` : `FAIL: ${r.errors.length} error(s)`);
  return r.ok ? 0 : 1;
}

process.exit(main(process.argv.slice(2)));

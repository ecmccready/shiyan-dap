// Run: npx tsx scripts/validate-peer-capabilities.ts <file.json>
// Operator tool: reads ONE local JSON file (a self capabilities object, or a saved /api/marketplace/peers registry) and checks the capabilities.
// No network, no fetching, no URL handling, writes no files. A pass means well-formed only, not verified or trusted.
// Exit codes: 0 well-formed (warnings allowed), 1 not well-formed or invalid JSON, 2 usage or file problem.
import { readFileSync, statSync } from "node:fs";
import { validatePeerCapabilities, formatCapabilitiesReport } from "../src/lib/marketplace/route-contract";

const MAX_BYTES = 5 * 1024 * 1024;
const USAGE = "Usage: npx tsx scripts/validate-peer-capabilities.ts <file.json>   (exactly one local file; no network, no writes)";

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
  const { lines, exitCode } = formatCapabilitiesReport(validatePeerCapabilities(parsed));
  for (const line of lines) console.log(line);
  return exitCode;
}

process.exit(main(process.argv.slice(2)));

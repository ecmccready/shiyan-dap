// Run: npx tsx scripts/check-route-contract.ts <peers|listings> <file.json>
// Operator tool: reads ONE local JSON file saved from a marketplace route and checks it has that route's shape.
// Catches route-content mix-ups that status-code checks miss (e.g. the peers registry served on the listings route).
// No network, no fetching, writes no files. A pass means well-formed only, not verified or trusted.
// Exit codes: 0 contract holds (warnings allowed), 1 contract failure or invalid JSON, 2 usage or file problem.
import { readFileSync, statSync } from "node:fs";
import { checkRouteContract, formatRouteContractReport, type RouteName } from "../src/lib/marketplace/route-contract";

const MAX_BYTES = 5 * 1024 * 1024;
const USAGE = "Usage: npx tsx scripts/check-route-contract.ts <peers|listings> <file.json>   (one local file; no network, no writes)";

function main(args: string[]): number {
  if (args.length !== 2 || (args[0] !== "peers" && args[0] !== "listings")) { console.error(USAGE); return 2; }
  const route: RouteName = args[0];
  const file = args[1];
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
  const { lines, exitCode } = formatRouteContractReport(route, checkRouteContract(route, parsed));
  for (const line of lines) console.log(line);
  return exitCode;
}

process.exit(main(process.argv.slice(2)));

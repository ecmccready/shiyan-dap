/**
 * VS Code stdio bridge. Same handler as POST /api/mcp.
 * Run: npx tsx scripts/mcp-stdio.ts
 */
import readline from "node:readline";
import { handleMcp } from "../src/lib/mcp/handler";

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const msg = JSON.parse(trimmed);
    if (msg.method === "notifications/initialized") return;
    const out = handleMcp(msg);
    process.stdout.write(JSON.stringify(out) + "\n");
  } catch (err) {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: String(err) },
      }) + "\n"
    );
  }
});

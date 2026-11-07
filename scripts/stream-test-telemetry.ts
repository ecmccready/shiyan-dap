/**
 * Local stream harness for /api/v1/telemetry.
 * Run the dev server (npm run dev), then: npx tsx scripts/stream-test-telemetry.ts
 * Override the target with TELEMETRY_URL.
 */
const url = process.env.TELEMETRY_URL || "http://localhost:3000/api/v1/telemetry";

const mockPayloads = [
  { predicted: 0.88, observed: 0.88, step: 1, phi: 0.159, auto_proof: true },
  { predicted: 0.95, observed: 0.41, step: 2, phi: 0.159, auto_proof: true },
];

async function ensureServer() {
  try {
    await fetch(url, { method: "GET" });
  } catch {
    console.error(`Server not reachable at ${new URL(url).origin}. Start the dev server first: npm run dev`);
    process.exit(1);
  }
}

async function main() {
  await ensureServer();
  let failed = false;
  for (const [i, payload] of mockPayloads.entries()) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let body: unknown = text;
      try { body = JSON.parse(text); } catch {}
      console.log(`frame ${i + 1} -> ${res.status}`);
      console.log(JSON.stringify(body, null, 2));
      if (!res.ok) failed = true;
    } catch (error) {
      failed = true;
      console.error(`frame ${i + 1} -> request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failed) process.exitCode = 1;
}

main();

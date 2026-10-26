import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import type { LedgerEventPayload, LedgerRecordResponse } from "@/types/ledger";

export const dynamic = "force-dynamic";

const DOMAINS = ["music", "diagnostics", "legal", "art", "software", "other"];

function fail(error: string, status = 400) {
  const body: LedgerRecordResponse = {
    ok: false,
    txHash: "",
    recordedAt: new Date().toISOString(),
    mock: true,
    error,
  };
  return NextResponse.json(body, { status });
}

/** Mock commit: validates the payload and returns a deterministic txHash. Persists nothing. */
export async function POST(req: Request) {
  let p: Partial<LedgerEventPayload>;
  try {
    p = (await req.json()) as Partial<LedgerEventPayload>;
  } catch {
    return fail("invalid JSON body");
  }
  if (!p || typeof p !== "object") return fail("body must be an object");
  for (const k of ["assetId", "eventType", "stateHash", "timestamp"] as const) {
    if (typeof p[k] !== "string" || !p[k]) return fail(`missing or invalid field: ${k}`);
  }
  if (!p.domain || !DOMAINS.includes(p.domain)) return fail("missing or invalid field: domain");
  if (Number.isNaN(Date.parse(p.timestamp as string))) return fail("timestamp must be ISO-8601");
  if (p.splits) {
    if (!Array.isArray(p.splits)) return fail("splits must be an array");
    const total = p.splits.reduce((s, x) => s + (Number(x?.shareBps) || 0), 0);
    if (p.splits.some((x) => !x?.recipientId) || total !== 10000) {
      return fail("splits must have recipientId and shareBps summing to 10000");
    }
  }
  const txHash =
    "0x" + createHash("sha256").update(JSON.stringify([p.assetId, p.eventType, p.stateHash, p.timestamp])).digest("hex");
  const body: LedgerRecordResponse = {
    ok: true,
    txHash,
    recordedAt: new Date().toISOString(),
    mock: true,
  };
  return NextResponse.json(body);
}

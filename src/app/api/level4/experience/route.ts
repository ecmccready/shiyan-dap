import { NextRequest, NextResponse } from "next/server";
import { requireLevel4Write } from "@/lib/level4/write-auth";
import { Redis } from "@upstash/redis";
import { toLedger } from "@/lib/level4/ledger";
import { TENSOR_COMMITMENT_RE } from "@/lib/level4/tensor";

/**
 * Durable Level 4 experience store.
 *
 * GET  → ExperienceEntry[] (oldest first; consumers read the last item as "latest").
 * GET ?format=ledger (or ?view=ledger) → { entries, ledger } — uniform,
 *      domain-neutral audit view: DOMAIN, E0, E1, DELTA_E, PHI, STATUS
 *      (ELIGIBLE_EXPERIENCE when Δe > 0, else MISDIAGNOSIS_REJECTED).
 *      The default response above is unchanged.
 *      Entries with tensor fields also carry TENSOR=<sha256:…> T_DIST=<x>.
 * POST → append one verified result from /workbench/autonomous.
 *
 * Read by: /workbench/status, /workbench/result.
 * Written by: recordExperienceServer() in src/lib/level4/verified.ts.
 * Same Upstash credentials as /api/level4/run and /api/level4/acquisition.
 */

export type ExperienceEntry = {
  run_id: string;
  iteration: number;
  e: number | null;
  verified_at: string;
  eligible: boolean;
  /** Optional measurement context (added with the engine-backed step). */
  y?: string;
  e0?: number | null;
  delta_e?: number | null;
  cold_e?: number | null;
  phi?: number | null;
  state?: string;
  /** Optional domain label (software, logistics, clinical, ...). Absent on older entries. */
  system?: string;
  /** Optional tensor scope: H(T_out) as "sha256:<64 hex>". Never the raw tensor. */
  tensor_commitment?: string;
  /** Optional tensor scope: distance of T_out from the sealed T_ref. */
  tensor_distance?: number;
};

const KEY = "level4:experience";
const MAX_ENTRIES = 200;
const SEEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const seenKey = (run_id: string, iteration: number) =>
  `level4:experience:seen:${run_id}:${iteration}`;

/** Keep the first entry per (run_id, iteration); preserves order. */
function dedupe(list: ExperienceEntry[]): ExperienceEntry[] {
  const seen = new Set<string>();
  return list.filter((x) => {
    const k = `${x.run_id}:${x.iteration}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function client(): Redis | null {
  const url = process.env.UPSTASH_KV_REST_API_URL;
  const token = process.env.UPSTASH_KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function wantsLedger(req: NextRequest | undefined): boolean {
  const q = req?.nextUrl?.searchParams;
  return q?.get("format") === "ledger" || q?.get("view") === "ledger";
}

export async function GET(req: NextRequest) {
  const ledger = wantsLedger(req);
  const redis = client();
  if (!redis) return NextResponse.json(ledger ? toLedger([]) : []);
  const all = dedupe((await redis.lrange<ExperienceEntry>(KEY, 0, -1)) ?? []);
  // Optional, additive: ?run_id= narrows to one run. Absent → unchanged response.
  const runFilter = req?.nextUrl?.searchParams?.get("run_id");
  const list = runFilter ? all.filter((x) => x.run_id === runFilter) : all;
  return NextResponse.json(ledger ? toLedger(list) : list);
}

export async function POST(req: NextRequest) {
  const denied = requireLevel4Write(req);
  if (denied) return denied;
  const redis = client();
  if (!redis) {
    return NextResponse.json({ error: "experience store not configured" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const run_id = typeof body.run_id === "string" ? body.run_id.slice(0, 80) : "";
  const iteration = num(body.iteration);
  if (!run_id || iteration === null) {
    return NextResponse.json({ error: "run_id and iteration required" }, { status: 400 });
  }

  const entry: ExperienceEntry = {
    run_id,
    iteration,
    e: num(body.e),
    verified_at:
      typeof body.verified_at === "string" ? body.verified_at : new Date().toISOString(),
    eligible: body.eligible === true,
    y: typeof body.y === "string" ? body.y.slice(0, 40) : undefined,
    e0: num(body.e0),
    delta_e: num(body.delta_e),
    cold_e: num(body.cold_e),
    phi: num(body.phi),
    state: typeof body.state === "string" ? body.state.slice(0, 16) : undefined,
  };
  // Optional domain label; stored only when provided, so older clients are unaffected.
  if (typeof body.system === "string" && body.system.trim()) {
    entry.system = body.system.trim().slice(0, 32);
  }
  // Optional tensor scope; stored only when valid, so older clients are unaffected.
  if (typeof body.tensor_commitment === "string" && TENSOR_COMMITMENT_RE.test(body.tensor_commitment)) {
    entry.tensor_commitment = body.tensor_commitment;
  }
  const tensorDistance = num(body.tensor_distance);
  if (tensorDistance !== null) entry.tensor_distance = tensorDistance;

  // Idempotent: one entry per (run_id, iteration). SET NX is atomic.
  const first = await redis.set(seenKey(run_id, iteration), 1, {
    nx: true,
    ex: SEEN_TTL_SECONDS,
  });
  if (first !== "OK") {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  await redis.rpush(KEY, entry);
  await redis.ltrim(KEY, -MAX_ENTRIES, -1);
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { requireLevel4Write } from "@/lib/level4/write-auth";
import { Redis } from "@upstash/redis";
import { toLedger } from "@/lib/level4/ledger";
import { TENSOR_COMMITMENT_RE } from "@/lib/level4/tensor";
import { roeForEntry } from "@/lib/level4/roe";
import { roeEligibility } from "@/lib/level4/roe-eligibility";

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
  /** Optional: which tensor bound produced the check ("holographic" | "fixed"). Absent on older entries. */
  tensor_bound?: "holographic" | "fixed";
  /** Optional: the bound's maxAllowable used for the check. Absent on older entries. */
  tensor_max_allowable?: number;
  /** Opt-in ROE drive only: which selector chose y. Absent on default-path entries. */
  selector?: "roe_step_aware";
  roe_lambda?: number;
  roe_mu?: number;
  roe_fallback?: boolean;
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
  try {
    return new Redis({ url, token });
  } catch (error) {
    console.error("Experience store configuration is invalid:", error);
    return null;
  }
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function isRunId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(value);
}

function isExperienceEntry(value: unknown): value is ExperienceEntry {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  const nullableNumbers = ["e", "e0", "delta_e", "cold_e", "phi"];
  const optionalNumbers = [
    "tensor_distance",
    "tensor_max_allowable",
    "roe_lambda",
    "roe_mu",
  ];
  const optionalStrings = ["y", "state", "system"];
  return (
    isRunId(entry.run_id) &&
    Number.isSafeInteger(entry.iteration) &&
    (entry.iteration as number) >= 0 &&
    (entry.e === null || (typeof entry.e === "number" && Number.isFinite(entry.e))) &&
    typeof entry.verified_at === "string" &&
    Number.isFinite(Date.parse(entry.verified_at)) &&
    typeof entry.eligible === "boolean" &&
    nullableNumbers.every(
      (field) =>
        entry[field] === undefined ||
        entry[field] === null ||
        (typeof entry[field] === "number" && Number.isFinite(entry[field]))
    ) &&
    optionalNumbers.every(
      (field) =>
        entry[field] === undefined ||
        (typeof entry[field] === "number" && Number.isFinite(entry[field]))
    ) &&
    optionalStrings.every(
      (field) =>
        entry[field] === undefined ||
        (typeof entry[field] === "string" && entry[field].length <= 200)
    ) &&
    (entry.tensor_commitment === undefined ||
      (typeof entry.tensor_commitment === "string" &&
        TENSOR_COMMITMENT_RE.test(entry.tensor_commitment))) &&
    (entry.tensor_bound === undefined ||
      entry.tensor_bound === "holographic" ||
      entry.tensor_bound === "fixed") &&
    (entry.selector === undefined || entry.selector === "roe_step_aware") &&
    (entry.roe_fallback === undefined || typeof entry.roe_fallback === "boolean")
  );
}

function wantsLedger(req: NextRequest | undefined): boolean {
  const q = req?.nextUrl?.searchParams;
  return q?.get("format") === "ledger" || q?.get("view") === "ledger";
}

export async function GET(req: NextRequest) {
  const ledger = wantsLedger(req);
  const redis = client();
  if (!redis) {
    return NextResponse.json(
      { error: "Experience store is not configured" },
      { status: 503 }
    );
  }
  try {
    const stored = (await redis.lrange<unknown>(KEY, 0, -1)) ?? [];
    if (!Array.isArray(stored) || !stored.every(isExperienceEntry)) {
      console.error("Experience store contains invalid entries");
      return NextResponse.json(
        { error: "Experience store contains invalid entries" },
        { status: 502 }
      );
    }
    const all = dedupe(stored);
  // Optional, additive: ?run_id= narrows to one run. Absent → unchanged response.
  const runFilter = req?.nextUrl?.searchParams?.get("run_id");
    if (runFilter !== null && runFilter !== undefined && !isRunId(runFilter)) {
      return NextResponse.json({ error: "Invalid run_id" }, { status: 400 });
    }
    const list = runFilter ? all.filter((x) => x.run_id === runFilter) : all;
    if (ledger) return NextResponse.json(toLedger(list));
  // Optional, additive (ROE): ?roe=1 attaches roe: { gates, G, delta_e, I } to each entry. Absent → unchanged.
    const roe = req?.nextUrl?.searchParams?.get("roe");
    if (roe === "1" || roe === "true") return NextResponse.json(list.map((x) => ({ ...x, roe: roeForEntry(x), roe_eligibility: roeEligibility(x) })));
    return NextResponse.json(list);
  } catch (error) {
    console.error("Experience read failed:", error);
    return NextResponse.json(
      { error: "Unable to read experience records" },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  const denied = requireLevel4Write(req);
  if (denied) return denied;
  const redis = client();
  if (!redis) {
    return NextResponse.json({ error: "experience store not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }
  const payload = body as Record<string, unknown>;

  if (
    !isRunId(payload.run_id) ||
    !Number.isSafeInteger(payload.iteration) ||
    (payload.iteration as number) < 0 ||
    typeof payload.eligible !== "boolean" ||
    (payload.e !== null &&
      (typeof payload.e !== "number" || !Number.isFinite(payload.e))) ||
    (payload.verified_at !== undefined &&
      (typeof payload.verified_at !== "string" ||
        !Number.isFinite(Date.parse(payload.verified_at))))
  ) {
    return NextResponse.json(
      { error: "Valid run_id, iteration, e, eligible, and verified_at are required" },
      { status: 400 }
    );
  }
  const optionalNumbers = [
    "e0",
    "delta_e",
    "cold_e",
    "phi",
    "tensor_distance",
    "tensor_max_allowable",
    "roe_lambda",
    "roe_mu",
  ];
  if (
    optionalNumbers.some(
      (field) =>
        payload[field] !== undefined &&
        payload[field] !== null &&
        (typeof payload[field] !== "number" || !Number.isFinite(payload[field]))
    ) ||
    ["y", "state", "system"].some(
      (field) =>
        payload[field] !== undefined &&
        (typeof payload[field] !== "string" || payload[field].length > 200)
    ) ||
    (payload.tensor_commitment !== undefined &&
      (typeof payload.tensor_commitment !== "string" ||
        !TENSOR_COMMITMENT_RE.test(payload.tensor_commitment))) ||
    (payload.tensor_bound !== undefined &&
      payload.tensor_bound !== "holographic" &&
      payload.tensor_bound !== "fixed") ||
    (payload.selector !== undefined && payload.selector !== "roe_step_aware") ||
    (payload.roe_fallback !== undefined && typeof payload.roe_fallback !== "boolean")
  ) {
    return NextResponse.json({ error: "Invalid optional experience fields" }, { status: 400 });
  }

  const entry: ExperienceEntry = {
    run_id: payload.run_id,
    iteration: payload.iteration as number,
    e: payload.e,
    verified_at:
      typeof payload.verified_at === "string" ? payload.verified_at : new Date().toISOString(),
    eligible: payload.eligible,
    y: typeof payload.y === "string" ? payload.y : undefined,
    e0: num(payload.e0),
    delta_e: num(payload.delta_e),
    cold_e: num(payload.cold_e),
    phi: num(payload.phi),
    state: typeof payload.state === "string" ? payload.state : undefined,
  };
  // Optional domain label; stored only when provided, so older clients are unaffected.
  if (typeof payload.system === "string" && payload.system.trim()) {
    entry.system = payload.system.trim();
  }
  // Optional tensor scope; stored only when valid, so older clients are unaffected.
  if (typeof payload.tensor_commitment === "string") {
    entry.tensor_commitment = payload.tensor_commitment;
  }
  const tensorDistance = num(payload.tensor_distance);
  if (tensorDistance !== null) entry.tensor_distance = tensorDistance;
  // Optional bound label + maxAllowable; stored only when valid, so older clients are unaffected.
  if (payload.tensor_bound === "holographic" || payload.tensor_bound === "fixed") entry.tensor_bound = payload.tensor_bound;
  const tensorMax = num(payload.tensor_max_allowable);
  if (tensorMax !== null && tensorMax > 0) entry.tensor_max_allowable = tensorMax;
  // Opt-in ROE drive (additive): recorded only when the client sent selector.
  if (payload.selector === "roe_step_aware") {
    entry.selector = "roe_step_aware";
    entry.roe_lambda = num(payload.roe_lambda) ?? 0;
    entry.roe_mu = num(payload.roe_mu) ?? 0;
    entry.roe_fallback = payload.roe_fallback === true;
  }

  // Idempotent: one entry per (run_id, iteration). SET NX is atomic.
  const run_id = entry.run_id;
  try {
    const first = await redis.set(seenKey(run_id, entry.iteration), 1, {
      nx: true,
      ex: SEEN_TTL_SECONDS,
    });
    if (first !== "OK") {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    try {
      await redis.rpush(KEY, entry);
    } catch (error) {
      console.error("Experience record append failed:", error);
      try {
        await redis.del(seenKey(run_id, entry.iteration));
      } catch (cleanupError) {
        console.error("Failed to clear experience idempotency marker:", cleanupError);
      }
      return NextResponse.json(
        { error: "Unable to save experience record" },
        { status: 502 }
      );
    }

    try {
      await redis.ltrim(KEY, -MAX_ENTRIES, -1);
      return NextResponse.json({ ok: true });
    } catch (error) {
      console.error("Experience record list trim failed:", error);
      return NextResponse.json(
        { error: "Unable to save experience record" },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("Experience idempotency check failed:", error);
    return NextResponse.json(
      { error: "Unable to save experience record" },
      { status: 502 }
    );
  }
}

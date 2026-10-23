import { NextRequest, NextResponse } from "next/server";
import { experiment, init, run, snapshot, step } from "@/lib/proof-loop";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(snapshot());
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { ok: false, error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }
  const payload = body as Record<string, unknown>;
  const flags = ["reset", "experiment", "run"].filter(
    (flag) => payload[flag] === true
  );
  if (flags.length > 1) {
    return NextResponse.json(
      { ok: false, error: "Choose only one proof operation" },
      { status: 400 }
    );
  }
  if (
    ["reset", "experiment", "run"].some(
      (flag) => payload[flag] !== undefined && typeof payload[flag] !== "boolean"
    )
  ) {
    return NextResponse.json(
      { ok: false, error: "Proof operation flags must be booleans" },
      { status: 400 }
    );
  }
  const trials = payload.trials ?? 5;
  const n = payload.n ?? 12;
  if (
    typeof trials !== "number" ||
    !Number.isSafeInteger(trials) ||
    trials < 1 ||
    trials > 100 ||
    typeof n !== "number" ||
    !Number.isSafeInteger(n) ||
    n < 1 ||
    n > 40
  ) {
    return NextResponse.json(
      { ok: false, error: "trials must be 1–100 and n must be 1–40" },
      { status: 400 }
    );
  }

  if (payload.reset === true) return NextResponse.json(init());
  if (payload.experiment === true) {
    return NextResponse.json(
      experiment(trials, n)
    );
  }
  if (payload.run === true) return NextResponse.json(run(n));
  return NextResponse.json(step());
}
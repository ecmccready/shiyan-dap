import { NextResponse } from "next/server";
import { computeB, isOutcomeTransition, Self } from "@/lib/outcomes";

export async function GET() {
  let latest: unknown;
  try {
    const response = await fetch(
      "https://huggingface.co/datasets/shiyan-dap/founder-z/resolve/main/latest-z.json",
      { cache: "no-store" }
    );
    if (!response.ok) {
      console.error("Self snapshot read failed with status:", response.status);
      return NextResponse.json(
        { ok: false, error: "Latest memory is unavailable" },
        { status: 502 }
      );
    }
    latest = await response.json();
    if (typeof latest !== "object" || latest === null || Array.isArray(latest)) {
      return NextResponse.json(
        { ok: false, error: "Latest memory returned invalid data" },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("Self snapshot request failed:", error);
    return NextResponse.json(
      { ok: false, error: "Latest memory is unavailable" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    protocol: "slice_v6",
    note: "Server Self() has no browser ledger. Head z is founder-z. Client Learn remains the live sensor.",
    head: latest,
    self: Self([]),
    computed_b: computeB([]),
  });
}

export async function POST(req: Request) {
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
  const outcomes = payload.outcomes === undefined ? [] : payload.outcomes;
  if (
    !Array.isArray(outcomes) ||
    outcomes.length > 500 ||
    !outcomes.every(isOutcomeTransition)
  ) {
    return NextResponse.json(
      { ok: false, error: "outcomes must contain valid transition records" },
      { status: 400 }
    );
  }
  const validOutcomes = outcomes.filter(isOutcomeTransition);
  const self = Self(validOutcomes);
  const b = computeB(validOutcomes);
  return NextResponse.json({
    ok: true,
    protocol: "slice_v6",
    self,
    computed_b: b,
    z: self.z,
  });
}
import { NextResponse } from "next/server";
import { computeB, Self, type OutcomeTransition } from "@/lib/outcomes";

export async function GET() {
  const hub = await fetch(
    "https://huggingface.co/datasets/shiyan-dap/founder-z/resolve/main/latest-z.json",
    { cache: "no-store" }
  ).catch(() => null);

  const latest = hub && hub.ok ? await hub.json() : { z: "Measure an asset." };

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
  const body = await req.json().catch(() => ({}));
  const outcomes = (body.outcomes || []) as OutcomeTransition[];
  const self = Self(outcomes);
  const b = computeB(outcomes);
  return NextResponse.json({
    ok: true,
    protocol: "slice_v6",
    self,
    computed_b: b,
    z: self.z,
  });
}
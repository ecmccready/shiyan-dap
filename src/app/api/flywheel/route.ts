import { NextResponse } from "next/server";
import { HFMemory, retrieveEligible } from "@/core/hf-memory";
import { recommendNextAction } from "@/core/roe-next-action";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const memory = new HFMemory();
    const latest = retrieveEligible(memory)[0] ?? null;
    const proposal = recommendNextAction(memory);
    return NextResponse.json({ latest, proposal }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Flywheel memory retrieval failed", error);
    return NextResponse.json({ error: "Verified memory could not be read. No recommendation was made." },
      { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

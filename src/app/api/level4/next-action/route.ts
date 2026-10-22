import { NextRequest, NextResponse } from "next/server";
import { readExperienceStore } from "@/lib/level4/experience-store";
import { roeNextAction } from "@/lib/level4/roe-next-action";
import { REUSE_SEQUENCE } from "@/lib/level4/measured";

/**
 * GET /api/level4/next-action?run_id=&lambda=&mu=&applied= — public, read-only, inspect-only.
 * ROE objective a* = argmax_{A_safe} [E(Δe|a) − λC(a) − μR(a)] over reusable stored
 * experience, compared with what the live durable plan would do next at step `applied`
 * (default 0). Never changes the autonomous loop.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const num = (k: string) => { const v = q.get(k); if (v == null || v === "") return undefined; const n = Number(v); return Number.isFinite(n) ? n : undefined; };
  const entries = await readExperienceStore().catch(() => null);
  if (entries == null) return NextResponse.json({ error: "experience store not configured" }, { status: 503 });
  return NextResponse.json({
    roe_next_action: roeNextAction(entries, {
      run_id: q.get("run_id") || null, lambda: num("lambda"), mu: num("mu"), applied: num("applied"),
      permitted: [...REUSE_SEQUENCE, "hold"],
    }),
  });
}

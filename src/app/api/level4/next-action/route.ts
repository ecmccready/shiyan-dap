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
  const run_id = q.get("run_id");
  if (run_id !== null && !/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(run_id)) {
    return NextResponse.json({ error: "Invalid run_id" }, { status: 400 });
  }
  const optionalNumber = (name: string) => {
    const raw = q.get(name);
    if (raw === null) return { valid: true, value: undefined };
    if (raw.trim() === "") return { valid: false, value: undefined };
    const value = Number(raw);
    return { valid: Number.isFinite(value), value };
  };
  const lambda = optionalNumber("lambda");
  const mu = optionalNumber("mu");
  const applied = optionalNumber("applied");
  if (
    !lambda.valid ||
    !mu.valid ||
    !applied.valid ||
    (lambda.value !== undefined && lambda.value < 0) ||
    (mu.value !== undefined && mu.value < 0) ||
    (applied.value !== undefined &&
      (!Number.isSafeInteger(applied.value) || applied.value < 0 || applied.value > 500))
  ) {
    return NextResponse.json(
      { error: "lambda and mu must be non-negative numbers; applied must be an integer from 0 to 500" },
      { status: 400 }
    );
  }
  let entries;
  try {
    entries = await readExperienceStore();
  } catch (error) {
    console.error("Next-action experience read failed:", error);
    return NextResponse.json({ error: "Unable to read experience records" }, { status: 502 });
  }
  if (entries == null) {
    return NextResponse.json({ error: "Experience store is not configured" }, { status: 503 });
  }
  return NextResponse.json({
    roe_next_action: roeNextAction(entries, {
      run_id,
      lambda: lambda.value,
      mu: mu.value,
      applied: applied.value,
      permitted: [...REUSE_SEQUENCE, "hold"],
      per_step: applied.value === undefined,
    }),
  });
}

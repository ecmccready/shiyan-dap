import { NextResponse } from "next/server";
import { readExperienceStore } from "@/lib/level4/experience-store";
import { coldBaseline, measureActions } from "@/lib/level4/measured";
import { roeForEntry } from "@/lib/level4/roe";
import { Y_ACTIONS, type YAction } from "@/lib/closed-loop";

/**
 * GET /api/level4/benchmark — public, read-only, reproducible.
 * Cross-run improvement on the demo plant: cold-start Self() baseline vs reuse
 * of the fixed demo run's action sequence. e, e0 and cold e are recomputed with
 * the existing deterministic plant (measureActions / coldBaseline); I_t comes
 * from roeForEntry on the stored entries. Reads the experience store only; never writes.
 */
const RUN_ID = "run_mvculg3c_wn6w0q";
const r3 = (n: number) => Number(n.toFixed(3));

export async function GET() {
  let entries;
  try {
    entries = await readExperienceStore();
  } catch (error) {
    console.error("Level 4 benchmark read failed:", error);
    return NextResponse.json(
      { version: "aethel-benchmark/1", run_id: RUN_ID, error: "Unable to read experience records" },
      { status: 502 }
    );
  }
  if (entries === null) {
    return NextResponse.json(
      { version: "aethel-benchmark/1", run_id: RUN_ID, error: "Experience store is not configured" },
      { status: 503 }
    );
  }
  const steps = entries
    .filter((entry) => entry.run_id === RUN_ID)
    .sort((a, b) => a.iteration - b.iteration);
  if (
    steps.length > 40 ||
    steps.some(
      (entry, index) =>
        entry.iteration !== index + 1 ||
        typeof entry.y !== "string" ||
        !Y_ACTIONS.some((action) => action === entry.y)
    )
  ) {
    console.error("Benchmark run contains an invalid action sequence");
    return NextResponse.json(
      { version: "aethel-benchmark/1", run_id: RUN_ID, error: "Benchmark run data is invalid" },
      { status: 502 }
    );
  }
  try {
    const actions: YAction[] = [];
    const rows = [];
    for (const entry of steps) {
      actions.push(entry.y as YAction);
      const measured = measureActions(actions);
      const cold = coldBaseline(actions.length);
      const roe = roeForEntry(entry);
      rows.push({
        iter: entry.iteration,
        y: entry.y,
        e_reuse: measured.e,
        e_cold: cold,
        delta_e: roe.delta_e,
        phi: r3(cold - measured.e),
        I: roe.I,
        G: roe.G,
      });
    }
    const first = rows[0];
    const last = rows[rows.length - 1];
    const summary = last
      ? {
          steps: rows.length,
          e_start: measureActions(actions.slice(0, 1)).e0,
          e_final: last.e_reuse,
          e_cold_final: last.e_cold,
          delta_e_total: r3(measureActions(actions).e0 - last.e_reuse),
          phi_final: last.phi,
          I_t: rows.map((row) => row.I),
          first_iter: first.iter,
        }
      : null;
    return NextResponse.json({
      version: "aethel-benchmark/1",
      run_id: RUN_ID,
      read_only: true,
      method: "replay of stored action sequence on a fresh demo plant; cold = Self() baseline at same step count",
      rows,
      summary,
    });
  } catch (error) {
    console.error("Level 4 benchmark calculation failed:", error);
    return NextResponse.json(
      { version: "aethel-benchmark/1", run_id: RUN_ID, error: "Unable to calculate benchmark" },
      { status: 502 }
    );
  }
}

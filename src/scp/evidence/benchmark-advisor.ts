/**
 * Reads a measured ECP5 benchmark and names the bottleneck plus the next
 * measured alternative. It does not invent an Fmax, a throughput, or a power number.
 * Unbuilt changes are returned only as hypotheses with measured: false.
 */

export type AdvisorDesign = {
  id: string;
  kind: "encoder" | "decoder" | "loop";
  milestone: string;
  fmax_mhz_median: number | null;
  throughput_values_per_s_median: number | null;
  values_per_s_per_lut: number | null;
  lut: number | null;
  ff: number | null;
  bram: number | null;
  /** Loop designs name the encoder and decoder placed beside them. */
  composed_of?: readonly string[];
};

export type AdvisorInput = {
  designs: readonly AdvisorDesign[];
  /** Copied from the benchmark. The advisor does not change it. */
  power: string;
};

export type RankedAlternative = {
  design_id: string;
  kind: AdvisorDesign["kind"];
  why: string;
  measured: true;
  fmax_mhz_median: number;
  throughput_values_per_s_median: number;
  lut: number | null;
  values_per_s_per_lut: number | null;
};

export type AdvisorReport = {
  focus_loop_id: string | null;
  bottleneck: { design_id: string; reason: string } | null;
  ranked_next: RankedAlternative[];
  hypotheses: { text: string; measured: false }[];
  power: string;
};

function byThroughput(a: AdvisorDesign, b: AdvisorDesign): number {
  const ta = a.throughput_values_per_s_median ?? -1;
  const tb = b.throughput_values_per_s_median ?? -1;
  return tb - ta || a.id.localeCompare(b.id);
}

function find(designs: readonly AdvisorDesign[], id: string): AdvisorDesign | undefined {
  return designs.find((d) => d.id === id);
}

export function adviseFromBenchmark(input: AdvisorInput): AdvisorReport {
  const hypotheses: AdvisorReport["hypotheses"] = [];
  const loops = input.designs.filter((d) => d.kind === "loop" && d.throughput_values_per_s_median !== null);
  const focus = [...loops].sort(byThroughput)[0] ?? null;
  if (!focus) {
    return {
      focus_loop_id: null,
      bottleneck: null,
      ranked_next: [],
      hypotheses: [{ text: "No closed loop in this benchmark has a measured throughput, so no bottleneck is named.", measured: false }],
      power: input.power,
    };
  }

  const parts = (focus.composed_of ?? [])
    .map((id) => find(input.designs, id))
    .filter((d): d is AdvisorDesign => !!d && d.fmax_mhz_median !== null);

  let bottleneck: AdvisorReport["bottleneck"];
  if (parts.length >= 2) {
    const slower = [...parts].sort((a, b) => (a.fmax_mhz_median! - b.fmax_mhz_median!) || a.id.localeCompare(b.id))[0];
    const faster = [...parts].sort((a, b) => (b.fmax_mhz_median! - a.fmax_mhz_median!) || a.id.localeCompare(b.id))[0];
    bottleneck = {
      design_id: slower.id,
      reason: `On ${focus.id}, ${slower.id} median post-route Fmax is ${slower.fmax_mhz_median} MHz and ${faster.id} is ${faster.fmax_mhz_median} MHz. The slower constituent limits the loop clock.`,
    };
  } else if (focus.fmax_mhz_median !== null) {
    bottleneck = {
      design_id: focus.id,
      reason: `${focus.id} median post-route Fmax is ${focus.fmax_mhz_median} MHz. Constituent Fmax was not both present, so the loop itself is the measured limit.`,
    };
  } else {
    bottleneck = null;
  }

  const kind = bottleneck ? (find(input.designs, bottleneck.design_id)?.kind ?? "loop") : "loop";
  const current = bottleneck ? find(input.designs, bottleneck.design_id) : focus;
  const alternatives = input.designs
    .filter((d) => d.kind === kind && d.id !== current?.id && d.throughput_values_per_s_median !== null && d.fmax_mhz_median !== null)
    .sort(byThroughput);

  const ranked_next: RankedAlternative[] = alternatives.map((d) => ({
    design_id: d.id,
    kind: d.kind,
    measured: true,
    fmax_mhz_median: d.fmax_mhz_median!,
    throughput_values_per_s_median: d.throughput_values_per_s_median!,
    lut: d.lut,
    values_per_s_per_lut: d.values_per_s_per_lut,
    why: `${d.id} (${d.milestone}) measured ${d.throughput_values_per_s_median} values/s at median Fmax ${d.fmax_mhz_median} MHz`
      + (d.lut === null ? "" : `, ${d.lut} LUT`)
      + (d.values_per_s_per_lut === null ? "" : `, ${d.values_per_s_per_lut} values/s per LUT`)
      + `.`,
  }));

  if (current && ranked_next.length > 0 && current.throughput_values_per_s_median !== null
    && ranked_next[0].throughput_values_per_s_median <= current.throughput_values_per_s_median) {
    hypotheses.push({
      text: `${current.id} is already the highest measured throughput of its kind in this benchmark (${current.throughput_values_per_s_median} values/s). A further unbuilt microarchitectural change has no measured Fmax or throughput.`,
      measured: false,
    });
  } else if (ranked_next.length === 0) {
    hypotheses.push({
      text: `No other measured ${kind} is in this benchmark. An unbuilt replacement has no measured Fmax or throughput.`,
      measured: false,
    });
  }

  const otherLoops = loops.filter((d) => d.id !== focus.id);
  if (otherLoops.length > 0 && kind !== "loop") {
    const bestOther = [...otherLoops].sort(byThroughput)[0];
    if (bestOther.throughput_values_per_s_median! > (focus.throughput_values_per_s_median ?? 0)) {
      hypotheses.push({
        text: `Measured loop ${bestOther.id} reaches ${bestOther.throughput_values_per_s_median} values/s, above the focus loop ${focus.id} at ${focus.throughput_values_per_s_median} values/s. That comparison is the loop rows in the benchmark, not a new design.`,
        measured: false,
      });
    }
  }

  hypotheses.push({
    text: "Power and energy are not measured. A ranking by energy would require a programmed board.",
    measured: false,
  });

  return { focus_loop_id: focus.id, bottleneck, ranked_next, hypotheses, power: input.power };
}

/** A later run may reuse a seed only when the source hash, tool id, part, seed and command hash all match. */
export function reuseDecision(
  prior: { source_sha256: string; tool_id: string; part: string; seed: number; command_sha256: string } | null,
  req: { source_sha256: string; tool_id: string; part: string; seed: number; command_sha256: string },
): "reuse" | "rerun" {
  if (!prior) return "rerun";
  const same = prior.source_sha256 === req.source_sha256
    && prior.tool_id === req.tool_id
    && prior.part === req.part
    && prior.seed === req.seed
    && prior.command_sha256 === req.command_sha256;
  return same ? "reuse" : "rerun";
}

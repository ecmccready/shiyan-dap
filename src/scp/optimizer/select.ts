/**
 * Pure selector over a frozen candidate catalogue.
 * It ranks from measured rows the caller already loaded. It does not invent
 * clocks, areas or power. Power is never a field here.
 */
export interface EvidenceRow {
  design: string;
  role: "encoder" | "decoder" | "loop";
  fmax_mhz: number;
  lut: number;
  fits: boolean;
  seeds: number;
  bit_exact: boolean;
  source: string;
}

export interface Candidate {
  id: string;
  class: string;
  /** What limiter this candidate is aimed at. */
  targets: "decoder_clock" | "encoder_clock" | "bytes" | "agent_ops";
  order: number;
  note: string;
}

export interface LedgerEntry {
  candidate: string;
  accepted: boolean;
}

export interface Ranked {
  id: string;
  rank: number;
  dominated_by: string | null;
  reason: string;
  gate_pass: boolean;
  /** 1[bit-exact ∧ fits ∧ 5 seeds] · max(0, measured Pareto gain). Gain is 0 until a five-seed run exists. */
  I: number;
}

export interface Bottleneck {
  name: string;
  target: Candidate["targets"];
  evidence: string[];
}

/** The loop is limited by whichever standalone end has the lower clock. */
export function bottleneck(rows: readonly EvidenceRow[]): Bottleneck {
  const dec = rows.filter((r) => r.role === "decoder" && r.fits);
  const enc = rows.filter((r) => r.role === "encoder" && r.fits);
  const loop = rows.filter((r) => r.role === "loop" && r.fits);
  if (!dec.length || !enc.length) {
    return { name: "insufficient measured rows", target: "decoder_clock", evidence: [] };
  }
  const slowDec = dec.reduce((a, b) => (a.fmax_mhz <= b.fmax_mhz ? a : b));
  const slowEnc = enc.reduce((a, b) => (a.fmax_mhz <= b.fmax_mhz ? a : b));
  const loopRow = loop.slice().sort((a, b) => a.fmax_mhz - b.fmax_mhz)[0];
  if (slowDec.fmax_mhz < slowEnc.fmax_mhz) {
    return {
      name: `${slowDec.design} limits the loop clock`,
      target: "decoder_clock",
      evidence: [slowDec.source, slowEnc.source, ...(loopRow ? [loopRow.source] : [])],
    };
  }
  return {
    name: `${slowEnc.design} limits the loop clock`,
    target: "encoder_clock",
    evidence: [slowEnc.source, slowDec.source, ...(loopRow ? [loopRow.source] : [])],
  };
}

/** I = 1[bit-exact ∧ fits ∧ 5 seeds] · max(0, measured Pareto gain). */
export function improvementIndex(bitExact: boolean, fits: boolean, seeds: number, measuredGain: number): number {
  const gate = bitExact && fits && seeds >= 5;
  return (gate ? 1 : 0) * Math.max(0, measuredGain);
}

export function rankCandidates(candidates: readonly Candidate[], limit: Bottleneck, ledger: readonly LedgerEntry[]): Ranked[] {
  const tried = new Set(ledger.map((e) => e.candidate));
  const aimed = candidates.filter((c) => c.targets === limit.target);
  const aimedSorted = aimed.slice().sort((a, b) => {
    const ta = tried.has(a.id) ? 1 : 0;
    const tb = tried.has(b.id) ? 1 : 0;
    return ta - tb || a.order - b.order;
  });
  const winner = aimedSorted[0];
  const ranked = candidates.slice().sort((a, b) => {
    const aa = a.targets === limit.target ? 0 : 1;
    const bb = b.targets === limit.target ? 0 : 1;
    const ta = tried.has(a.id) ? 1 : 0;
    const tb = tried.has(b.id) ? 1 : 0;
    return aa - bb || ta - tb || a.order - b.order;
  });
  return ranked.map((c, i) => {
    const onTarget = c.targets === limit.target;
    const dominated = onTarget && winner && c.id !== winner.id ? winner.id : null;
    return {
      id: c.id,
      rank: i + 1,
      dominated_by: dominated,
      reason: tried.has(c.id)
        ? "already recorded in the ledger"
        : onTarget
          ? `targets ${limit.target}: ${limit.name}`
          : `does not target ${limit.target}`,
      gate_pass: false,
      I: improvementIndex(false, true, 1, 0),
    };
  });
}

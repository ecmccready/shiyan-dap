/** TEST ONLY. Golden vectors for scp4d_ede / scp4d_fsd.
 * Temporal-only is the default file. Relations-mode vectors are a separate file.
 * Churn fractions match the v0.1.20 pre-registration. Codes stay inside the 16-bit analytic bound.
 */
import { mulberry32 } from "./scp-v012-fixtures";
import {
  EDE_ANALYTIC_CODE_BITS, EDE_DECLARED_CODE_BITS, EDE_FAN, codeBits, runEde, runFsd, sameChangeSet,
  type Change, type FanSlot, type Tok,
} from "./scp-v0120-ede-model";

export const EDE_D = 32;
export const EDE_T = 3;
export const EDE_THRESHOLD = 0;
const CHURNS = [
  { id: "low", fraction: 0.01 },
  { id: "medium", fraction: 0.05 },
  { id: "high", fraction: 0.2 },
  { id: "very_high", fraction: 0.5 },
] as const;

export interface EdeVector {
  id: string;
  mode: "temporal" | "relations";
  D: number;
  threshold: number;
  fan: { src: number; slot: number; tgt: number; valid: 0 | 1 }[];
  tokens: { elem: number; code: number; event: 0 | 1; eof: 0 | 1; last: 0 | 1 }[];
  ede: { changes: Change[]; cycles: number; evals: number; err: number };
  fsd: { changes: Change[]; cycles: number; evals: number; err: number } | null;
  census_bits: number;
  same_change_set: boolean | null;
}

function emptyFan(D: number): FanSlot[][] {
  return Array.from({ length: D }, () => Array.from({ length: EDE_FAN }, () => ({ tgt: 0, valid: false })));
}

function fanList(fan: FanSlot[][]): EdeVector["fan"] {
  const out: EdeVector["fan"] = [];
  fan.forEach((slots, src) => slots.forEach((slot, i) => {
    if (slot.valid) out.push({ src, slot: i, tgt: slot.tgt, valid: 1 });
  }));
  return out;
}

function pack(id: string, mode: "temporal" | "relations", D: number, threshold: number, fan: FanSlot[][], tokens: Tok[], withFsd: boolean): EdeVector {
  const ede = runEde(D, threshold, mode === "relations", fan, tokens);
  const fsd = withFsd && ede.err === 0 ? runFsd(D, threshold, tokens) : null;
  let census = codeBits(threshold);
  for (const t of tokens) if (t.event) census = Math.max(census, codeBits(t.code));
  return {
    id, mode, D, threshold, fan: fanList(fan),
    tokens: tokens.map((t) => ({ elem: t.elem, code: t.code, event: t.event ? 1 : 0, eof: t.eof ? 1 : 0, last: t.last ? 1 : 0 })),
    ede: { changes: ede.changes, cycles: ede.cycles, evals: ede.evals, err: ede.err },
    fsd: fsd ? { changes: fsd.changes, cycles: fsd.cycles, evals: fsd.evals, err: fsd.err } : null,
    census_bits: census,
    same_change_set: fsd ? sameChangeSet(ede.changes, fsd.changes) : null,
  };
}

function churnTokens(seed: number, fraction: number): Tok[] {
  const D = EDE_D;
  const k = Math.max(1, Math.round(fraction * D));
  const rng = mulberry32((Math.imul(seed, 10007) + Math.round(fraction * 10000)) >>> 0);
  const code = new Array<number>(D).fill(0);
  const tokens: Tok[] = [];
  for (let t = 0; t < EDE_T; t++) {
    const idx = Array.from({ length: D }, (_, i) => i);
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(rng() * (D - i));
      const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp;
    }
    const picked = idx.slice(0, k).sort((a, b) => a - b);
    for (const cell of picked) code[cell] = (rng() < 0.5 ? -1 : 1) * (2 + ((seed + t + cell) % 5));
    picked.forEach((cell, i) => tokens.push({
      elem: cell, code: code[cell], event: true,
      eof: i === picked.length - 1, last: t === EDE_T - 1 && i === picked.length - 1,
    }));
  }
  return tokens;
}

function relationFan(D: number): FanSlot[][] {
  const fan = emptyFan(D);
  for (let i = 0; i < D; i++) fan[i][0] = { tgt: (i + 1) % D, valid: true };
  return fan;
}

export function temporalVectors(): EdeVector[] {
  const D = EDE_D;
  const fan = emptyFan(D);
  const out: EdeVector[] = [];
  for (const seed of [1, 2, 3, 4, 5]) for (const c of CHURNS) {
    out.push(pack(`churn-${c.id}-seed${seed}`, "temporal", D, EDE_THRESHOLD, fan, churnTokens(seed, c.fraction), true));
  }
  out.push(pack("bare-eof", "temporal", D, EDE_THRESHOLD, fan, [{ elem: 0, code: 0, event: false, eof: true, last: true }], true));
  out.push(pack("margin-zero", "temporal", D, 5, fan, [{ elem: 2, code: 5, event: true, eof: true, last: true }], true));
  out.push(pack("neg-elem", "temporal", D, EDE_THRESHOLD, fan, [{ elem: D, code: 1, event: true, eof: true, last: true }], false));
  return out;
}

export function relationsVectors(): EdeVector[] {
  const D = EDE_D;
  const fan = relationFan(D);
  const out: EdeVector[] = [];
  for (const seed of [1, 2, 3, 4, 5]) for (const c of CHURNS) {
    out.push(pack(`churn-${c.id}-seed${seed}`, "relations", D, EDE_THRESHOLD, fan, churnTokens(seed, c.fraction), true));
  }
  const bad = emptyFan(D);
  bad[0][0] = { tgt: D + 3, valid: true };
  out.push(pack("neg-fan-target", "relations", D, EDE_THRESHOLD, bad, [{ elem: 0, code: 4, event: true, eof: true, last: true }], false));
  return out;
}

export function vectorFile(mode: "temporal" | "relations", vectors: EdeVector[]) {
  return {
    format: mode === "temporal" ? "scp4d-ede-golden-v0120" : "scp4d-ede-relations-golden-v0120",
    version: 1,
    label: "TEST ONLY. Synthetic event streams. Temporal-only is the default; relations is a separate file. No measured energy.",
    default_mode: mode === "temporal" ? "temporal" : "relations",
    declared_code_bits: EDE_DECLARED_CODE_BITS,
    analytic_code_bits: EDE_ANALYTIC_CODE_BITS,
    vectors,
  };
}

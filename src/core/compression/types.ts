// 4D state compression (M1): shared types. Pure declarations; no runtime behaviour.
// 4D state = (predicted, observed, phi) x time, per tenant. See docs/design/4d-state-compression.md.

export const STATE_SEGMENT_VERSION = "aethel.state-segment/1";
export const DEFAULT_SEGMENT_SIZE = 256;
/** Only records with this provenance.source are compressed; all others are excluded and counted. */
export const STATE_SOURCE = "third-party-workbench";

export type StateVerdict = "PASS" | "FAIL" | "INCONCLUSIVE";

/** Shape of one shiyan.experiences row as a caller supplies it (proof_timestamp as an ISO string). */
export interface SourceRow {
  tenant_id: string;
  experience_id: string;
  record_json: string;
  content_sha256: string;
  proof_timestamp: string;
}

/** The 4D state of one run plus its stored verdict. */
export interface StateVector {
  /** proof_timestamp in epoch milliseconds. */
  t: number;
  predicted: number;
  observed: number;
  phi: number;
  step: number;
  verdict: StateVerdict;
}

/** A StateVector with the identity of the source row it came from. */
export interface StatePoint extends StateVector {
  experience_id: string;
  content_sha256: string;
}

export type ExclusionReason =
  | "invalid_row"
  | "tenant_mismatch"
  | "hash_mismatch"
  | "invalid_json"
  | "invalid_record"
  | "not_third_party_workbench"
  | "unparseable_inputs"
  | "invalid_verdict"
  | "invalid_timestamp"
  | "duplicate_id";

export interface Excluded {
  experience_id: string | null;
  reason: ExclusionReason;
}

export interface ExclusionSummary {
  count: number;
  reasons: Partial<Record<ExclusionReason, number>>;
}

/** M1-M2 are lossless only. Bounded-loss is deferred to M3 as an opt-in mode. */
export type LossMode = { mode: "lossless" };

export interface StateSegment {
  version: typeof STATE_SEGMENT_VERSION;
  tenant_id: string;
  seq: number;
  count: number;
  /** First timestamp (epoch ms) and non-negative integer deltas for the remaining points. */
  t0: number;
  dt: number[];
  /** float64 columns, XOR-delta coded over IEEE-754 bit patterns, lowercase hex without leading zeros. */
  predicted: string[];
  observed: string[];
  phi: string[];
  step: string[];
  /** One character per point: P = PASS, F = FAIL, I = INCONCLUSIVE. */
  verdicts: string;
  /** Merkle root over (experience_id, content_sha256) of the source rows, in point order. */
  source_ids_root: string;
  loss: LossMode;
  prev_segment_sha256: string | null;
}

export interface SealedSegment {
  segment: StateSegment;
  /** sha256(canonical(segment)), using canonical() from src/core/reconcile.ts. */
  segment_sha256: string;
}

export interface CompressOptions {
  /** Points per segment; default 256. */
  segmentSize?: number;
  /** Seal a final partial window as its own segment. Default false: the remainder is reported as pending. */
  sealPartial?: boolean;
}

export interface TenantCompression {
  tenant_id: string;
  segments: SealedSegment[];
  excluded: ExclusionSummary;
  /** Included points not yet sealed into a segment (partial window). */
  pending: number;
  head_sha256: string | null;
}

export interface VerifyResult {
  ok: boolean;
  errors: string[];
}

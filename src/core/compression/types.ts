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
  /** M3, optional: the row's DB arrival time (shiyan.experiences.created_at, ISO). Orders windows; never hashed. */
  created_at?: string;
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

/** Per-axis tolerances for the opt-in bounded-loss mode (M3). Each must be finite and > 0. */
export interface AxisEps {
  predicted: number;
  observed: number;
  phi: number;
}

/**
 * Lossless is the default and its segment bytes are unchanged since M1. Bounded (M3, opt-in) quantizes
 * predicted/observed/phi to round(v / eps) per axis and records eps plus the measured max |v - v'|.
 * t, step, verdicts and source identities are never lossy.
 */
export type LossMode = { mode: "lossless" } | { mode: "bounded"; eps: AxisEps; max_abs_err: AxisEps };

/** Caller's choice of loss mode; max_abs_err is always measured, never supplied. */
export type LossOption = { mode: "lossless" } | { mode: "bounded"; eps: AxisEps };

export const STATE_CONTEXT_VERSION = "aethel.state-context/1";
export type RecoveryStatusCode = "PROMOTED" | "DRIFT_EXCEEDED" | "REJECTED";

/**
 * M3 enrichment, embedded in a segment only when the caller supplies an anchors source, and therefore
 * covered by segment_sha256 and the chain. Hashes, counts and ids only. "as_of" is the window's seal time
 * (epoch ms): only anchor-DB rows created at or before it are considered, so a sealed segment never changes.
 */
export interface SegmentContext {
  version: typeof STATE_CONTEXT_VERSION;
  as_of: number;
  recovery: {
    /** recovery_records whose run_id is one of this segment's runs (provenance.run_id), created <= as_of. */
    count: number;
    by_status: Partial<Record<RecoveryStatusCode, number>>;
    /** Merkle root over the linked record_sha256 values, sorted; null when count is 0. */
    records_root: string | null;
  };
  /** Latest reference anchor for the tenant created <= as_of, or an explicit "none". Never invented. */
  reference:
    | { status: "present"; reference_id: string; commit_sha: string; snapshot_sha256: string; envelope_sha256: string }
    | { status: "none" };
}

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
  /** M3, optional: absent unless enrichment was requested, so plain lossless segments hash exactly as in M1. */
  context?: SegmentContext;
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

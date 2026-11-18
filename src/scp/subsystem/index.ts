/**
 * 4D-SCP subsystem — the single entry module (v0.1.9).
 *
 * Interfaces the owner named, one module each:
 *   state_encoder       → state-encoder.ts      (environment → S(x, y, z, t))
 *   state_compressor    → state-compressor.ts   (full / delta / tensor / combined 4D-SCP)
 *   temporal_state      → temporal-state.ts     (append-only, event-driven surface)
 *   state_reconstructor → state-reconstructor.ts (bytes → state, fidelity with error bounds)
 *   state_predictor     → state-predictor.ts    (last-value, linear)
 *   compression_bench   → compression-bench.ts  (ratio, fidelity, decisions, dirty fraction, energy estimate)
 *
 * Unwired by design: nothing in src/app or src/lib/level4 imports this, and this imports nothing
 * from them (scripts/check-scp-boundary.ts). A later, separately approved milestone may call it
 * from one flag-gated, read-only edge; until then only scripts/tests call it.
 */
export type {
  ChannelEps, CompressOptions4D, CompressedState4D, DecisionAgreement, DecisionTask4D, FidelityReport4D, FrameMeta,
  GridShape, OpCounts4D, ReconstructedState4D, Relation4D, Scp4dConfig, StateCompressor4D, StateEncoder4D,
  StatePredictor, StateReconstructor4D, StateSurface4D, StrategyId,
} from "./types";
export { elementCount, elementIndex, encodeFramesAsSurface, encodeScpFrames, gridEncoder, validateRelations, FRAME_CHANNELS } from "./state-encoder";
export type { GridEnvironment } from "./state-encoder";
export { SCP4D_RANKS, SCP4D_SEARCH, addOps, stateCompressor, zeroOps } from "./state-compressor";
export { fidelity, stateReconstructor } from "./state-reconstructor";
export { TemporalStateSurface } from "./temporal-state";
export type { BaseFn, EventUpdate, TemporalStateOptions } from "./temporal-state";
export { lastValuePredictor, linearPredictor, predictorByName } from "./state-predictor";
export { BENCH_STRATEGIES, benchStrategy, benchSurface, decisionAgreement, dirtyFraction, estimateEnergy } from "./compression-bench";
export type { BenchRow, BenchRun, EnergyEstimate, EnergyTable } from "./compression-bench";
export { energyProfile, lowRankFit, symmetricEigen } from "./linalg";
export type { EigenResult, LowRankFactors } from "./linalg";
export { quantize as quantizeLikePack } from "./format";

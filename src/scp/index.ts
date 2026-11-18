/**
 * 4D State Compression Processor — isolated stubs. See docs/design/4d-scp-architecture.md.
 * Do not import this package from src/app or src/lib/level4.
 */
export type {
  CompressOptions, FidelityReport, FidelityVerifier, ScpEncodeOptions, ScpFrame,
  ScpMeasurement, ScpProcessor, StateCompressor, StateDecoder, StateEncoder,
  StateScheduler, TemporalState,
} from "./types";
export { frameFromStateVector } from "./types";
export {
  notImplementedCompressor, notImplementedDecoder, notImplementedEncoder,
  notImplementedProcessor, notImplementedScheduler, notImplementedVerifier, scpNotImplemented,
} from "./not-implemented";
export type { PackedEps, PackedPoint, PackedVerdict, QuantizedEncodeResult, QuantizedIntBaselineResult } from "./pack";
export {
  decodeBinaryBaseline, decodeQuantized, decodeQuantizedFloatBaseline, decodeQuantizedIntBaseline,
  encodeBinaryBaseline, encodeQuantized, encodeQuantizedFloatBaseline, encodeQuantizedIntBaseline,
  isBinaryBaseline, isQuantizedEncoding, isQuantizedFloatBaseline, isQuantizedIntBaseline,
} from "./pack";

/** v0.1.9 isolated subsystem (state_encoder … compression_bench). Same boundary: scripts/tests only. */
export * as subsystem from "./subsystem";

/**
 * Not-implemented 4D-SCP reference. Every method throws a clear error.
 * Unwired: not imported by app routes or Level 4.
 */
import type {
  CompressOptions, FidelityReport, FidelityVerifier, ScpEncodeOptions, ScpFrame,
  ScpProcessor, StateCompressor, StateDecoder, StateEncoder, StateScheduler, TemporalState,
} from "./types";

export function scpNotImplemented(name: string): never {
  throw new Error(`4D-SCP: ${name} is not implemented (spec stubs only)`);
}

export const notImplementedEncoder: StateEncoder = {
  encode(_input: unknown, _options?: ScpEncodeOptions): ScpFrame[] {
    return scpNotImplemented("StateEncoder.encode");
  },
};

export const notImplementedCompressor: StateCompressor = {
  compress(_frames: readonly ScpFrame[], _options?: CompressOptions): TemporalState {
    return scpNotImplemented("StateCompressor.compress");
  },
};

export const notImplementedDecoder: StateDecoder = {
  decode(_state: TemporalState): ScpFrame[] {
    return scpNotImplemented("StateDecoder.decode");
  },
};

export const notImplementedVerifier: FidelityVerifier = {
  verify(_original: readonly ScpFrame[], _reconstructed: readonly ScpFrame[]): FidelityReport {
    return scpNotImplemented("FidelityVerifier.verify");
  },
};

export const notImplementedScheduler: StateScheduler = {
  schedule(_state: TemporalState): void {
    scpNotImplemented("StateScheduler.schedule");
  },
};

export function notImplementedProcessor(): ScpProcessor {
  return {
    encoder: notImplementedEncoder,
    compressor: notImplementedCompressor,
    decoder: notImplementedDecoder,
    fidelity: notImplementedVerifier,
    scheduler: notImplementedScheduler,
  };
}

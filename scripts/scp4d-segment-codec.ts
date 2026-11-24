/** TEST ONLY. Optional scp4d sidecar for one sealed window.
 * Uses the integer golden model (scripts/scp-v0110-int-scp4d.ts) and the integer-only
 * state_encoder surface mapping. Does not write a database and does not change segment_json.
 * Power is needs real board. No PHI.
 */
import { createHash } from "node:crypto";
import type { StatePoint } from "../src/core/compression/types";
import { encodeFramesAsSurface } from "../src/scp/subsystem/state-encoder";
import { decodeIntScp4d, DEFAULT_G, encodeIntScp4d, ingestCodes, type IntConfig } from "./scp-v0110-int-scp4d";

const CFG: IntConfig = { rank: 0, relations: false, predictor: "zero", G: DEFAULT_G };
const EPS = [1, 1, 1] as const;

export interface Scp4dSidecar {
  bytes: Uint8Array;
  sha256: string;
  frames: number;
}

function sameCodes(a: readonly Float64Array[], b: readonly Float64Array[]): boolean {
  if (a.length !== b.length) return false;
  for (let t = 0; t < a.length; t++) {
    if (a[t].length !== b[t].length) return false;
    for (let e = 0; e < a[t].length; e++) if (a[t][e] !== b[t][e]) return false;
  }
  return true;
}

/** Encode one window's points to an S4DI stream and require a bit-exact integer decode. */
export function encodeWindowScp4d(points: readonly StatePoint[]): Scp4dSidecar {
  if (points.length < 1) throw new RangeError("scp4d codec needs at least one point");
  const surface = encodeFramesAsSurface(points.map((p) => ({
    x: p.predicted, y: p.observed, z: p.phi, t: p.t, step: p.step, verdict: p.verdict,
  })), "scp4d-segment");
  const codes = ingestCodes(surface.frames, surface.shape.channels, EPS, CFG.G);
  const enc = encodeIntScp4d({
    shape: surface.shape,
    times: surface.times,
    meta: surface.meta,
    eps: [...EPS],
    relations: [],
  }, codes, CFG);
  const dec = decodeIntScp4d(enc.bytes, []);
  if (!sameCodes(enc.decoded, dec.codes)) throw new RangeError("scp4d round-trip is not bit-exact");
  return {
    bytes: enc.bytes,
    sha256: createHash("sha256").update(enc.bytes).digest("hex"),
    frames: points.length,
  };
}

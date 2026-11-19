/**
 * TEST ONLY. 4D-SCP v0.1.14 — job list, host header composition and exact cycle model of the RTL
 * temporal-only ENCODER (hw/scp4d/rtl/scp4d_tenc_w.v). Pure: no I/O, no env, no clocks, no
 * randomness, no Level 4 / app imports.
 *
 * Encoder input = integer codes x (post-quantizer, grid g = eps / 2^G), exactly the v0.1.10 model's
 * ingest codes (ingestCodes). Every expected stream is produced by the v0.1.10 integer model
 * (encodeIntScp4d) for ONE fixed configuration (the hardware does no config search); native
 * configurations must reproduce the committed golden-vector bytes exactly.
 *
 * tencCycleModel() is a register-transfer abstraction of the RTL as designed, at full rate (a code
 * beat and a header beat offered every cycle, out_ready = 1): configuration (5 cycles), header
 * engine, analysis pipeline (S0 accept, S1, S2, S3 close; frame t + 2 waits until frame t is
 * emitted), record prefetch (3-entry FIFO), emitter (START + sparse one event / cycle or dense W
 * elements / cycle), the one-entry
 * append stage and the 16-byte output queue with the same registered-count append rule. It models token LENGTHS only, so it
 * predicts cycles, not bytes. The check compares it with the simulator for every job and (W, L).
 */
import { ENV_EPS, ENV_LABEL, makeEnvironment } from "./scp-v019-env-fixture";
import { frontEndFloat } from "./scp-v018-integer-model";
import {
  decodeIntScp4d, emptyIntCensus, encodeIntScp4d, ingestCodes, IntWriter, zeroIntOps,
  type FrameEvents, type IntConfig, type IntPredictor, type IntStreamInput,
} from "./scp-v0110-int-scp4d";
import type { FrameMeta, GridShape } from "../src/scp/subsystem";

export const ENC_CONFIGS = [{ W: 1, L: 1 }, { W: 2, L: 2 }, { W: 2, L: 4 }, { W: 2, L: 8 }] as const;
export const LOOP_CONFIGS = [{ W: 2, L: 2 }, { W: 2, L: 4 }, { W: 2, L: 8 }] as const;
export const ENC_BQ = 16;
/** start cycle + CFG0..CFG3 before the first RUN edge */
export const ENC_CFG_CYCLES = 5;
export const ENC_MAX_D = 2048;

export interface EncJob {
  id: string; source: string; native: boolean; label: string;
  shape: GridShape; eps: number[]; times: number[]; meta: FrameMeta | null; cfg: IntConfig;
  T: number; D: number;
  codes: number[][];        // encoder input (ingest codes)
  bytes: Uint8Array;        // model stream (expected encoder output)
  decoded: number[][];      // model reconstruction (expected decoder output)
  perFrame: FrameEvents[];
  encode_ops_total: number; // v0.1.10 instrumented hot-path encode ops (ingest excluded)
  header_bytes: number;
}

export interface GoldenLike {
  id: string; shape: GridShape; eps_f64_bits: string[]; config: IntConfig; times: number[]; meta: unknown;
  input_codes: number[][]; expected_bytes_hex: string;
}
const hexBits = (h: string) => { const b = Buffer.from(h, "hex"); return b.readDoubleBE(0); };
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

function build(id: string, source: string, native: boolean, label: string, input: IntStreamInput, codes: Float64Array[], cfg: IntConfig): EncJob {
  const r = encodeIntScp4d(input, codes, cfg);
  if (r.cfg.rank !== 0 || r.cfg.relations) throw new RangeError(`${id}: not temporal-only`);
  const d = decodeIntScp4d(r.bytes, []);
  return {
    id, source, native, label, shape: input.shape, eps: [...input.eps], times: [...input.times], meta: input.meta ?? null, cfg: r.cfg,
    T: codes.length, D: codes[0].length, codes: codes.map((f) => Array.from(f)), bytes: r.bytes,
    decoded: d.codes.map((f) => Array.from(f)), perFrame: r.perFrame,
    encode_ops_total: r.ops.add + r.ops.shift + r.ops.bit + r.ops.cmp + r.ops.mul, header_bytes: r.header_bytes,
  };
}

/** Jobs: every in-scope golden vector at its native config and the two other predictors, G variants, env T64 / T256. */
export function encoderJobs(v0110: { vectors: (GoldenLike & { config: IntConfig })[] }, temporal: { vectors: GoldenLike[] }): { jobs: EncJob[]; nativeMismatch: string[] } {
  const jobs: EncJob[] = [];
  const nativeMismatch: string[] = [];
  const preds: IntPredictor[] = ["zero", "last", "linear"];
  const fromVector = (v: GoldenLike, source: string) => {
    const input: IntStreamInput = { shape: v.shape, times: v.times, meta: (v.meta ?? undefined) as FrameMeta | undefined, eps: v.eps_f64_bits.map(hexBits), relations: [] };
    const codes = v.input_codes.map((f) => Float64Array.from(f));
    for (const p of preds) {
      const native = p === v.config.predictor;
      const base = v.id.replace(/-temporal-(last|linear)$/, "");
      const id = native ? v.id : `${base}-${p}`;
      if (!native && jobs.some((j) => j.id === id)) continue;
      if (!native && temporal.vectors.some((t) => t.id === `${base}-temporal-${p}`)) continue; // covered natively
      const j = build(id, native ? source : `${source} (${v.id} input codes, predictor := ${p}, encoded by the v0.1.10 model)`, native, "TEST-ONLY (labelled fixture)", input, codes, { rank: 0, relations: false, predictor: p, G: v.config.G });
      if (native && hex(j.bytes) !== v.expected_bytes_hex) nativeMismatch.push(v.id);
      jobs.push(j);
    }
  };
  for (const v of v0110.vectors) if (v.config.rank === 0 && !v.config.relations) fromVector(v, "fixtures/scp/golden-vectors-scp4d.json");
  for (const v of temporal.vectors) fromVector(v, "fixtures/scp/golden-vectors-scp4d-temporal.json");
  // G variants on the small environment (ingest codes depend on G)
  const envSmall = makeEnvironment({ nx: 4, ny: 4, nz: 1, T: 8 }).surface;
  for (const G of [0, 12]) {
    const codes = ingestCodes(envSmall.frames, envSmall.shape.channels, [...ENV_EPS], G);
    jobs.push(build(`env-4x4x1-T8-last-G${G}`, `regenerated: makeEnvironment(4x4x1, T8), ingestCodes at G = ${G}, encoded by the v0.1.10 model`, false, ENV_LABEL,
      { shape: envSmall.shape, times: envSmall.times, meta: envSmall.meta, eps: [...ENV_EPS], relations: [] }, codes, { rank: 0, relations: false, predictor: "last", G }));
  }
  // the v0.1.10 environment streams
  for (const T of [64, 256]) {
    const s = makeEnvironment({ nx: 16, ny: 16, nz: 2, T }).surface;
    const codes = ingestCodes(s.frames, s.shape.channels, [...ENV_EPS], 8);
    const input: IntStreamInput = { shape: s.shape, times: s.times, meta: s.meta, eps: [...ENV_EPS], relations: [] };
    for (const p of (T === 64 ? ["last", "zero", "linear"] : ["last"]) as IntPredictor[]) {
      jobs.push(build(p === "last" ? `env-16x16x2-T${T}-temporal-last` : `env-16x16x2-T${T}-${p}`,
        p === "last" ? "regenerated (as scripts/scp-v0111-rtl-vectors.ts envTemporalStreams)" : `regenerated env T${T} codes, predictor := ${p}, encoded by the v0.1.10 model`, p === "last", ENV_LABEL, input, codes, { rank: 0, relations: false, predictor: p, G: 8 }));
    }
  }
  return { jobs, nativeMismatch };
}

/** Host-composed, setup-only header segments: eps float64 bit patterns (LE) and the times / meta varints. */
export function hostHeader(j: Pick<EncJob, "eps" | "times" | "meta">): { eps: Uint8Array; tm: Uint8Array } {
  const we = new IntWriter(zeroIntOps(), emptyIntCensus());
  for (const e of j.eps) we.bits64(frontEndFloat(e).bits);
  const w = new IntWriter(zeroIntOps(), emptyIntCensus());
  w.svarint(j.times[0]);
  for (let i = 1; i < j.times.length; i++) w.svarint(j.times[i] - j.times[i - 1]);
  w.u8(j.meta ? 1 : 0);
  if (j.meta) {
    w.svarint(j.meta.steps[0]);
    for (let i = 1; i < j.times.length; i++) w.svarint(j.meta.steps[i] - j.meta.steps[i - 1]);
    for (const v of j.meta.verdicts) w.u8(["PASS", "FAIL", "INCONCLUSIVE"].indexOf(v));
  }
  return { eps: we.bytes(), tm: w.bytes() };
}

/** The header bytes the RTL writes itself + the host segments, in stream order (must equal the model header). */
export function composedHeader(j: EncJob): Uint8Array {
  const h = hostHeader(j), s = j.shape, T = j.T;
  const u16 = (v: number) => [v & 0xff, (v >> 8) & 0xff];
  const f1 = [0x53, 0x34, 0x44, 0x49, 1, T & 0xff, (T >>> 8) & 0xff, (T >>> 16) & 0xff, (T >>> 24) & 0xff, ...u16(s.nx), ...u16(s.ny), ...u16(s.nz), ...u16(s.channels)];
  const f3 = [0, 0, ["zero", "last", "linear"].indexOf(j.cfg.predictor), 16, j.D <= 8 ? 1 : 0];
  return Uint8Array.from([...f1, ...h.eps, j.cfg.G, ...h.tm, ...f3]);
}

const uvl = (n: number) => { let s = 1; while (n >= 128) { n = Math.floor(n / 128); s++; } return s; };
const svl = (q: number) => uvl(q >= 0 ? 2 * q : -2 * q - 1);

/**
 * Exact cycle model (full rate). Returns the TB count: from the `start` cycle (1) to the cycle
 * `done` is observed, inclusive.
 */
export function tencCycleModel(j: EncJob, W: number, L: number, nhdrEps: number, nhdrTm: number): {
  cycles: number; run_cycles: number; header_done_edge: number; analysis_last_edge: number; in_stall_cycles: number;
  emit_start_cycles: number; emit_body_cycles: number; emit_space_stalls: number; emit_record_stalls: number; out_bytes: number; out_beats: number;
} {
  const BQ = ENC_BQ, D = j.D, T = j.T, ng = Math.ceil(D / L), lastn = D - (ng - 1) * L, alld = D <= 8;
  const lanes = (g: number) => (g === ng - 1 ? lastn : L);
  // per-frame records and q per element
  const frames = j.perFrame.map((f) => {
    const q = new Map<number, number>();
    f.positions.forEach((p, k) => q.set(p, f.q[k]));
    const recs: number[] = [];
    for (const p of f.positions) { const g = Math.floor(p / L); if (recs[recs.length - 1] !== g) recs.push(g); }
    return { n: f.positions.length, dense: f.dense, pos: f.positions, qs: f.q, q, recs };
  });
  // header segments
  const segs = [{ host: false, len: 17 }, { host: true, len: nhdrEps }, { host: false, len: 1 }, { host: true, len: nhdrTm }, { host: false, len: 5 }];
  let bcnt = 0, stg = 0, emitDone = false, hseg = 0, hcnt = 0, hdrDone = false;
  let aT = 0, aG = 0; const hbusy = [false, false];
  // pipeline: list of (edge at which close becomes visible as dvalid, frame)
  const closeAt: { edge: number; t: number }[] = [];
  const dvalid = [false, false];
  let body = false, eF = 0, eK = 0, eG = 0, eLane = 0, eR = 0;
  // record prefetch FIFO (3 entries) fed by sequential record-memory reads
  let pfF = 0, pfI = 0, pfN = 0, pfOn = false, rv = 0, fcnt = 0, recStall = 0;
  let edge = ENC_CFG_CYCLES, hdrDoneEdge = -1, lastTake = -1, inStall = 0, nStart = 0, nBody = 0, spaceStall = 0, outBytes = 0, outBeats = 0;
  for (;;) {
    edge++;
    if (edge > 50_000_000) throw new Error("cycle model did not terminate");
    // registered-state view at this edge
    for (const c of closeAt) if (c.edge === edge) dvalid[c.t & 1] = true;  // set at S3 (edge - 1), visible now
    if (emitDone && stg === 0 && bcnt === 0) return { cycles: edge + 1, run_cycles: edge - ENC_CFG_CYCLES, header_done_edge: hdrDoneEdge, analysis_last_edge: lastTake, in_stall_cycles: inStall,
      emit_start_cycles: nStart, emit_body_cycles: nBody, emit_space_stalls: spaceStall, emit_record_stalls: recStall, out_bytes: outBytes, out_beats: outBeats };
    const outValid = bcnt >= W || (emitDone && stg === 0 && bcnt > 0);
    const occ = bcnt + stg;  // queue + append stage
    const pop = outValid ? Math.min(bcnt, W) : 0;
    if (outValid) { outBytes += pop; outBeats++; }
    let app = 0;
    let fin = false, finHalf = -1, fpop = 0;
    const eF0 = eF, dv0 = [dvalid[0], dvalid[1]];
    const rEn = pfOn && pfI !== pfN && fcnt + rv <= 2;
    const hdV = fcnt > 0;
    // header engine / emitter (append source)
    if (!hdrDone) {
      const s = segs[hseg], rem = s.len - hcnt;
      if (occ + W <= BQ) {
        const n = s.host ? Math.min(W, rem) : Math.min(W, rem);
        app = n;
        if (hcnt + n === s.len) { hcnt = 0; hseg++; if (hseg === 5) { hdrDone = true; hdrDoneEdge = edge; } } else hcnt += n;
      }
    } else if (!emitDone) {
      const F = frames[eF], h = eF & 1;
      if (!body) {
        if (dvalid[h]) {
          const hlen = alld ? 0 : uvl(2 * F.n + (F.dense ? 1 : 0));
          if (occ + hlen <= BQ) {
            app = hlen; nStart++;
            eK = 0; eG = 0; eLane = 0; eR = 0;
            if (!F.dense && F.n === 0) { fin = true; } else body = true;
          } else spaceStall++;
        }
      } else if (!F.dense) {
        const p = F.pos[eK], prev = eK === 0 ? 0 : F.pos[eK - 1] + 1;
        const n = uvl(p - prev) + svl(F.qs[eK]);
        if (!hdV) recStall++;
        else if (occ + n <= BQ) {
          app = n; nBody++;
          if (eK === F.n - 1 || Math.floor(F.pos[eK + 1] / L) !== Math.floor(p / L)) fpop = 1;
          eK++; if (eK === F.n) { fin = true; body = false; }
        } else spaceStall++;
      } else {
        const ln = lanes(eG), need = eR < F.recs.length, match = need && F.recs[eR] === eG;
        let n = 0;
        for (let w = 0; w < W; w++) if (eLane + w < ln) n += svl(F.q.get(eG * L + eLane + w) ?? 0);
        if (need && !hdV) recStall++;
        else if (occ + n <= BQ) {
          app = n; nBody++;
          if (eLane + W >= ln) { if (match) { fpop = 1; eR++; } eG++; eLane = 0; if (eG === ng) { fin = true; body = false; } } else eLane += W;
        } else spaceStall++;
      }
      if (fin) { finHalf = h; eF++; if (eF === T) emitDone = true; }
    }
    // analysis S0 (registered hbusy)
    const accOk = aT < T && (aG !== 0 || !hbusy[aT & 1]);
    const take = accOk;
    if (!accOk && aT < T) inStall++;
    const newBusy = take && aG === 0 ? aT & 1 : -1;
    if (take) {
      lastTake = edge;
      if (aG === ng - 1) { closeAt.push({ edge: edge + 4, t: aT }); aG = 0; aT++; } else aG++;
    }
    // prefetch (registered view: eF0, dv0)
    const pfI0 = pfI;
    if (rEn) pfI++;
    if (!pfOn) {
      if (pfF < eF0) pfF++;
      else if (pfF < T && (pfF === eF0 || pfF === eF0 + 1) && dv0[pfF & 1]) { pfOn = true; pfN = frames[pfF].recs.length; pfI = 0; }
    } else if (pfI0 === pfN) { pfOn = false; pfF++; }
    fcnt = fcnt + rv - fpop; rv = rEn ? 1 : 0;
    if (fcnt > 3 || fcnt < 0) throw new Error("record FIFO out of range in model");
    if (finHalf >= 0) { hbusy[finHalf] = false; dvalid[finHalf] = false; }
    if (newBusy >= 0) hbusy[newBusy] = true;
    bcnt = bcnt - pop + stg; stg = app;
    if (bcnt > BQ) throw new Error("byte queue overflow in model");
  }
}

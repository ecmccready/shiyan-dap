/**
 * TEST ONLY. 4D-SCP v0.1.15 — configurations and exact cycle model of the PIPELINED RTL temporal-only
 * ENCODER (hw/scp4d/rtl/scp4d_tenc_p.v). Pure: no I/O, no env, no clocks, no randomness, no
 * Level 4 / app imports.
 *
 * The job list, the host header segments and the expected streams are the v0.1.14 ones, imported
 * unchanged from scripts/scp-v0114-rtl-model.ts (every expected stream is produced by the v0.1.10
 * integer model for one fixed configuration; native configurations reproduce the golden bytes).
 *
 * tencpCycleModel() is a register-transfer abstraction of scp4d_tenc_p as designed, at full rate (a
 * code beat and a header beat offered every cycle, out_ready = 1): configuration (5 cycles), header
 * engine, analysis pipeline (S0 accept, S1r, S1a, S1b, S2a, S2b, S3 close: a frame's descriptor is
 * visible 7 edges after its last beat is accepted; frame t + 2 waits until frame t is emitted; a
 * one-group frame (D <= L) accepts at most every other cycle), record prefetch (4-entry FIFO, one
 * read per cycle, up to two records leave per cycle), emitter (START + sparse one event / cycle, or
 * two when W = 4; dense W elements / cycle), the one-entry append stage and the 32-byte output queue
 * with the constant append rule (queue + staged <= 32 - MA). It models token LENGTHS only, so it
 * predicts cycles, not bytes. The check compares it with the simulator for every job and (W, L).
 */
import type { EncJob } from "./scp-v0114-rtl-model";

export const ENCP_CONFIGS = [{ W: 1, L: 1 }, { W: 2, L: 2 }, { W: 2, L: 4 }, { W: 2, L: 8 }, { W: 4, L: 4 }, { W: 4, L: 8 }] as const;
/** encoder W -> scp4d_tdec_w with the same W */
export const LOOPP_CONFIGS = [{ W: 2, L: 2 }, { W: 2, L: 4 }, { W: 2, L: 8 }, { W: 4, L: 4 }, { W: 4, L: 8 }] as const;
export const ENCP_BQ = 32;
export const ENCP_CFG_CYCLES = 5;
/** edges from the accept of a frame's last beat to its descriptor (dvalid) being usable */
export const ENCP_CLOSE_EDGES = 7;
export const encpES = (W: number) => (W >= 4 ? 2 : 1);
export const encpMA = (W: number) => Math.max(5 * W, 7 * encpES(W));

const uvl = (n: number) => { let s = 1; while (n >= 128) { n = Math.floor(n / 128); s++; } return s; };
const svl = (q: number) => uvl(q >= 0 ? 2 * q : -2 * q - 1);

/** Exact cycle model (full rate). Returns the TB count: from the `start` cycle (1) to the cycle `done` is observed, inclusive. */
export function tencpCycleModel(j: EncJob, W: number, L: number, nhdrEps: number, nhdrTm: number): {
  cycles: number; run_cycles: number; header_done_edge: number; analysis_last_edge: number; in_stall_cycles: number;
  emit_start_cycles: number; emit_body_cycles: number; emit_two_event_cycles: number; emit_space_stalls: number; emit_record_stalls: number; out_bytes: number; out_beats: number;
} {
  const BQ = ENCP_BQ, MA = encpMA(W), ES = encpES(W), D = j.D, T = j.T, ng = Math.ceil(D / L), lastn = D - (ng - 1) * L, alld = D <= 8;
  const lanes = (g: number) => (g === ng - 1 ? lastn : L);
  const frames = j.perFrame.map((f) => {
    const q = new Map<number, number>();
    f.positions.forEach((p, k) => q.set(p, f.q[k]));
    const recs: number[] = [];
    for (const p of f.positions) { const g = Math.floor(p / L); if (recs[recs.length - 1] !== g) recs.push(g); }
    return { n: f.positions.length, dense: f.dense, pos: f.positions, qs: f.q, q, recs };
  });
  const segs = [{ len: 17 }, { len: nhdrEps }, { len: 1 }, { len: nhdrTm }, { len: 5 }];
  let bcnt = 0, stg = 0, emitDone = false, hseg = 0, hcnt = 0, hdrDone = false;
  let aT = 0, aG = 0; const hbusy = [false, false];
  const closeAt: { edge: number; t: number }[] = [];
  const dvalid = [false, false];
  let body = false, eF = 0, eK = 0, eG = 0, eLane = 0, eR = 0;
  let pfF = 0, pfI = 0, pfN = 0, pfOn = false, rv = 0, fcnt = 0, recStall = 0;
  let edge = ENCP_CFG_CYCLES, hdrDoneEdge = -1, lastTake = -1, inStall = 0, nStart = 0, nBody = 0, nTwo = 0, spaceStall = 0, outBytes = 0, outBeats = 0;
  const sameRec = (F: { pos: number[] }, k: number) => Math.floor(F.pos[k + 1] / L) === Math.floor(F.pos[k] / L);
  for (;;) {
    edge++;
    if (edge > 50_000_000) throw new Error("cycle model did not terminate");
    for (const c of closeAt) if (c.edge === edge) dvalid[c.t & 1] = true;
    if (emitDone && stg === 0 && bcnt === 0) return { cycles: edge + 1, run_cycles: edge - ENCP_CFG_CYCLES, header_done_edge: hdrDoneEdge, analysis_last_edge: lastTake, in_stall_cycles: inStall,
      emit_start_cycles: nStart, emit_body_cycles: nBody, emit_two_event_cycles: nTwo, emit_space_stalls: spaceStall, emit_record_stalls: recStall, out_bytes: outBytes, out_beats: outBeats };
    const outValid = bcnt >= W || (emitDone && stg === 0 && bcnt > 0);
    const occ = bcnt + stg;
    const room = occ + MA <= BQ;
    const pop = outValid ? Math.min(bcnt, W) : 0;
    if (outValid) { outBytes += pop; outBeats++; }
    let app = 0;
    let fin = false, finHalf = -1, fpop = 0;
    const eF0 = eF, dv0 = [dvalid[0], dvalid[1]];
    const rEn = pfOn && pfI !== pfN && fcnt + rv <= 3;
    const hdV = fcnt > 0;
    if (!hdrDone) {
      const s = segs[hseg], rem = s.len - hcnt;
      if (room) {
        const n = Math.min(W, rem);
        app = n;
        if (hcnt + n === s.len) { hcnt = 0; hseg++; if (hseg === 5) { hdrDone = true; hdrDoneEdge = edge; } } else hcnt += n;
      }
    } else if (!emitDone) {
      const F = frames[eF], h = eF & 1;
      if (!body) {
        if (dvalid[h]) {
          const hlen = alld ? 0 : uvl(2 * F.n + (F.dense ? 1 : 0));
          if (room) {
            app = hlen; nStart++;
            eK = 0; eG = 0; eLane = 0; eR = 0;
            if (!F.dense && F.n === 0) { fin = true; } else body = true;
          } else spaceStall++;
        }
      } else if (!F.dense) {
        if (!hdV) recStall++;
        else if (room) {
          const p = F.pos[eK], prev = eK === 0 ? 0 : F.pos[eK - 1] + 1;
          let n = uvl(p - prev) + svl(F.qs[eK]);
          const same2 = eK + 1 < F.n && sameRec(F, eK);
          const take2 = ES === 2 && eK + 1 < F.n && (same2 || fcnt >= 2);
          if (!take2) { if (!same2) fpop = 1; eK++; }
          else {
            const p2 = F.pos[eK + 1];
            n += uvl(p2 - (p + 1)) + svl(F.qs[eK + 1]);
            const done2 = eK + 2 >= F.n || !sameRec(F, eK + 1);
            fpop = (same2 ? 0 : 1) + (done2 ? 1 : 0);
            eK += 2; nTwo++;
          }
          app = n; nBody++;
          if (eK === F.n) { fin = true; body = false; }
        } else spaceStall++;
      } else {
        const ln = lanes(eG), need = eR < F.recs.length, match = need && F.recs[eR] === eG;
        let n = 0;
        for (let w = 0; w < W; w++) if (eLane + w < ln) n += svl(F.q.get(eG * L + eLane + w) ?? 0);
        if (need && !hdV) recStall++;
        else if (room) {
          app = n; nBody++;
          if (eLane + W >= ln) { if (match) { fpop = 1; eR++; } eG++; eLane = 0; if (eG === ng) { fin = true; body = false; } } else eLane += W;
        } else spaceStall++;
      }
      if (fin) { finHalf = h; eF++; if (eF === T) emitDone = true; }
    }
    // analysis S0 (registered hbusy; one-group frames accept at most every other cycle)
    const accOk = aT < T && (aG !== 0 || !hbusy[aT & 1]) && !(ng === 1 && lastTake === edge - 1);
    const take = accOk;
    if (!accOk && aT < T) inStall++;
    const newBusy = take && aG === 0 ? aT & 1 : -1;
    if (take) {
      lastTake = edge;
      if (aG === ng - 1) { closeAt.push({ edge: edge + ENCP_CLOSE_EDGES, t: aT }); aG = 0; aT++; } else aG++;
    }
    // prefetch (registered view: eF0, dv0)
    const pfI0 = pfI;
    if (rEn) pfI++;
    if (!pfOn) {
      if (pfF < eF0) pfF++;
      else if (pfF < T && (pfF === eF0 || pfF === eF0 + 1) && dv0[pfF & 1]) { pfOn = true; pfN = frames[pfF].recs.length; pfI = 0; }
    } else if (pfI0 === pfN) { pfOn = false; pfF++; }
    fcnt = fcnt + rv - fpop; rv = rEn ? 1 : 0;
    if (fcnt > 4 || fcnt < 0) throw new Error("record FIFO out of range in model");
    if (finHalf >= 0) { hbusy[finHalf] = false; dvalid[finHalf] = false; }
    if (newBusy >= 0) hbusy[newBusy] = true;
    bcnt = bcnt - pop + stg; stg = app;
    if (bcnt > BQ) throw new Error("byte queue overflow in model");
  }
}

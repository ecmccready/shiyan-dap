/**
 * TEST ONLY. 4D-SCP v0.1.18 — exact cycle model of the TWO-STAGE RTL temporal-only DECODER
 * (hw/scp4d/rtl/scp4d_tdec_s.v, front end hw/scp4d/rtl/scp4d_fe_r.v from v0.1.17). Pure: no I/O, no
 * env, no clocks, no randomness, no Level 4 / app imports.
 *
 * Why the cycles change against v0.1.13 / v0.1.17 (scp4d_tdec_w / scp4d_tdec_r, one issue chain): the
 * chain is split into a token classifier and a bank issuer joined by a record queue, so
 *   - the classifier starts as soon as the header is parsed, during the background state clear (the
 *     issuer still waits for the clear), which removes most of the clear wait from the critical path;
 *   - a head token is classified alone (one classifier cycle per sparse / dense frame head);
 *   - in a sparse frame the classifier pops up to K tokens per cycle with no bank limit (gap / q
 *     alternate), and a frame end or an error ends its cycle;
 *   - records spend one cycle in a register (rec_r) before entering the record queue (RQ = 3W
 *     entries), and the classifier only runs while rq_cnt + rec_n + K <= RQ (registered counts);
 *   - the issuer sees the first P records: last hold issues event records in order until a bank repeats
 *     (no token limit, no step limit other than P records); zero / linear hold issue the aligned block of
 *     P elements around a cursor, up to the last visible record's limit; a frame end or error ends its
 *     cycle;
 *   - the tail is the same three-stage bank pipeline.
 * This is a register-transfer abstraction of the RTL as designed, at full-rate input (the testbench's
 * no-bubble mode). It walks the real token values (element indices, q != 0, frame ends), so it predicts
 * cycle counts and the classifier / issuer counters, not codes. The check compares it with the
 * simulator's measured counts for every in-scope vector and W in {1, 2, 4}.
 */
import { streamStructure } from "./scp-v0111-rtl-vectors";
import { payloadTokens } from "./scp-v0113-rtl-model";

export const TDECS_W_LIST = [1, 2, 4] as const;
/** Cycles counted after the edge on which the issuer retires the last frame until `done` is observed (TB count). */
export const TDECS_TAIL = 4;
/** Record queue depth in records. */
export const tdecsRQ = (W: number) => 3 * W;
export { LOOPQ_CONFIGS as LOOPS_CONFIGS } from "./scp-v0116-rtl-model";

interface Tok { v: number; len: number }
/** Front end (scp4d_fe_r = scp4d_fe_w queues and rules): byte queue + tokenizer + token queue, one step per edge. */
class FrontEnd {
  readonly BQ: number; readonly TQ: number;
  ptr = 0; bcnt = 0; tokMode = false; tcnt = 0; tokIdx = 0;
  private ends: number[];
  constructor(readonly W: number, readonly K: number, readonly n: number, header: number, toks: Tok[]) {
    this.BQ = 2 * W; this.TQ = 2 * W + K;
    this.ends = []; let p = header; for (const t of toks) { p += t.len; this.ends.push(p - 1); }
  }
  get head(): number { return this.ptr - this.bcnt; }
  step(hdrPop: number, tokPop: number, setTokMode: boolean): void {
    const W = this.W;
    const inReady = this.bcnt + W <= this.BQ;
    let bpop = 0, nt = 0;
    if (this.tokMode) {
      if (this.tcnt + W <= this.TQ) {
        bpop = Math.min(this.bcnt, W);
        const to = this.head + bpop - 1;
        while (this.tokIdx + nt < this.ends.length && this.ends[this.tokIdx + nt] <= to) nt++;
      }
    } else bpop = hdrPop;
    this.bcnt -= bpop;
    if (inReady && this.ptr < this.n) { const nb = Math.min(W, this.n - this.ptr); this.ptr += nb; this.bcnt += nb; }
    this.tcnt = this.tcnt - tokPop + nt; this.tokIdx += nt;
    if (setTokMode) this.tokMode = true;
  }
}

/** element record (the RTL's rq entry, data fields only as far as timing needs them) */
interface Rec { lim: number; e: number; ev: boolean; eof: boolean }

export interface TdecSModel {
  W: number; cycles: number; header_cycles: number; payload_cycles: number; tail: number;
  pops: number; records: number; lanes: number; iss_idle: number; cls_stall: number;
  first_issue_edge: number; clear_overlap: number;
}
export function tdecSCycleModel(buf: Uint8Array, W: number): TdecSModel {
  const s = streamStructure(buf);
  const { header, fixed, toks } = payloadTokens(buf);
  const P = W, K = W, RQ = tdecsRQ(W), D = s.D, T = s.T, last = s.predictor === 1;
  const fe = new FrontEnd(W, K, buf.length, header, toks);
  const clrLen = Math.ceil(D / P);
  let hdrDone = 0, allDense = false, clrActive = false, clrCnt = 0, clrDone = false;
  // classifier
  type CS = "IDLE" | "HEAD" | "SP" | "DENSE" | "END";
  let cs: CS = "IDLE", ph = 0, bp = 0, nxt = 0, left = 0, dbase = 0, fr = 0, tq = 0;
  // record register, queue, issuer
  let recR: Rec[] = [], rq: Rec[] = [];
  let cur = 0, ifr = 0, irun = false;
  const r = { pops: 0, records: 0, lanes: 0, iss_idle: 0, cls_stall: 0 };
  let edge = 0, hdrCycles = 0, finishEdge = -1, firstPay = -1, firstIssue = -1, clearOverlap = 0;
  const nextClr = () => { if (clrActive) { if (clrCnt === clrLen - 1) { clrActive = false; clrDone = true; } else clrCnt++; } };
  while (finishEdge < 0) {
    if (edge > 50 * buf.length + 100000) throw new Error("tdec_s model did not finish");
    if (hdrDone < header) {
      hdrCycles++;
      let hdrPop = 0, setTok = false;
      if (!fe.tokMode && fe.bcnt > 0) {
        hdrPop = 1;
        if (hdrDone === fixed - 1) { nextClr(); clrActive = true; clrCnt = 0; hdrDone++; fe.step(1, 0, false); edge++; continue; }
        if (hdrDone === header - 1) {
          setTok = true; allDense = buf[header - 1] === 1; cs = allDense ? "DENSE" : "HEAD";
          fr = 0; ifr = 0; cur = 0; irun = true;
        }
        hdrDone++;
      }
      nextClr(); fe.step(hdrPop, 0, setTok); edge++; continue;
    }
    if (firstPay < 0) firstPay = edge;
    if (!clrDone) clearOverlap++;
    // ---------- stage 1: classifier (registered state) ----------
    const run = cs === "HEAD" || cs === "SP" || cs === "DENSE";
    const room = rq.length + recR.length + K <= RQ;
    if (run && !room) r.cls_stall++;
    const out: Rec[] = [];
    let k = 0;
    if (run && room) {
      const avail = Math.min(fe.tcnt, K);
      let adv = false;
      for (let i = 0; i < avail && !adv; i++) {
        const t = toks[tq + i];
        if (cs === "HEAD") {
          k = 1;
          const n = Math.floor(t.v / 2);
          if (t.v % 2 === 1) { cs = "DENSE"; dbase = 0; }
          else if (n === 0) { out.push({ lim: D, e: 0, ev: false, eof: true }); adv = true; }
          else { cs = "SP"; ph = 0; bp = 0; left = n; }
          break;                                          // a head token is classified alone
        }
        k++;
        if (cs === "SP") {
          if (ph === 1) {                                 // q at the pending element
            const eof = left === 0;
            out.push({ lim: eof ? D : nxt + 1, e: nxt, ev: true, eof });
            bp = nxt + 1; ph = 0;
            if (eof) adv = true;
          } else {                                        // gap / first index
            nxt = bp + t.v; left--; ph = 1;
            if (nxt >= D) throw new Error("model: index out of range (in-scope streams only)");
          }
        } else {                                          // dense
          const e = dbase; dbase++;
          const eof = e === D - 1;
          out.push({ lim: eof ? D : e + 1, e, ev: t.v !== 0, eof });
          if (eof) adv = true;
        }
      }
      if (adv) { fr++; cs = fr === T ? "END" : allDense ? "DENSE" : "HEAD"; ph = 0; bp = 0; dbase = 0; }
    }
    // ---------- stage 2: issuer (registered queue, cursor, registered clear-done) ----------
    let p = 0;
    if (clrDone && irun) {
      const win: Rec[] = [];
      for (let j = 0; j < Math.min(P, rq.length); j++) { win.push(rq[j]); if (rq[j].eof) break; }
      let eof = false;
      if (last) {
        let used = 0;
        for (const x of win) {
          const bit = 1 << (x.e % P);
          if (x.ev && (used & bit)) break;
          p++;
          if (x.ev) { used |= bit; r.lanes++; }
          if (x.eof) eof = true;
        }
      } else {
        const bb = cur - (cur % P), bend = bb + P;
        const lmax = win.length ? win[win.length - 1].lim : cur;
        const ncur = bend <= lmax ? bend : Math.max(lmax, cur);
        if (ncur > cur) r.lanes += ncur - cur;
        for (const x of win) { if (x.lim <= ncur) { p++; if (x.eof) eof = true; } else break; }
        cur = ncur;
      }
      if (p === 0) r.iss_idle++;
      if (p > 0 && firstIssue < 0) firstIssue = edge;
      if (eof) { ifr++; cur = 0; if (ifr === T) { irun = false; finishEdge = edge; } }
    }
    // ---------- edge ----------
    rq = rq.slice(p).concat(recR);
    recR = out;
    r.pops += k; r.records += out.length; tq += k;
    nextClr(); fe.step(0, k, false); edge++;
  }
  return {
    W, cycles: finishEdge + 1 + TDECS_TAIL, header_cycles: hdrCycles, payload_cycles: finishEdge + TDECS_TAIL - firstPay, tail: TDECS_TAIL,
    ...r, first_issue_edge: firstIssue, clear_overlap: clearOverlap,
  };
}

/**
 * TEST ONLY. 4D-SCP v0.1.13 — cycle models of the W-byte-per-cycle RTL decoders
 * (hw/scp4d/rtl/scp4d_tdec_w.v, scp4d_rdec_w.v, both fed by scp4d_fe_w.v). Pure: no I/O, no env,
 * no clocks, no randomness.
 *
 * The models are register-transfer abstractions of the RTL as designed, at full-rate input (the
 * testbench's no-bubble mode: a W-byte beat is offered every cycle): front-end byte queue (BQ = 2W)
 * and token queue (TQ = 2W + K) occupancies with the same registered-count rules, the header parsed
 * one byte per cycle, the background state clear (ceil(D / P) cycles, P = W banks for tdec_w;
 * D cycles for rdec_w), the issue chain / parser state machine, fan-out, settle and flush. They do
 * not model data values (only element indices and token boundaries), so they predict cycle counts,
 * not codes. The check compares them with the simulator's measured counts for every in-scope
 * vector and W in {1, 2, 4}; the committed report can then be re-verified without a simulator.
 */
import type { RtlProgram } from "./scp-v0112-rtl-vectors";
import { streamStructure } from "./scp-v0111-rtl-vectors";

export const W_LIST = [1, 2, 4] as const;
/** Cycles counted after the edge that retires the last frame until `done` is observed (TB count). */
export const TDECW_TAIL = 4;
export const RDECW_TAIL = 5;

interface Tok { v: number; len: number }
/** Header length (bytes up to and including the layout byte) and the payload varint tokens. */
export function payloadTokens(buf: Uint8Array): { header: number; fixed: number; toks: Tok[] } {
  const s = streamStructure(buf);
  const header = s.fixed_bytes + s.header_tail_bytes;
  const toks: Tok[] = [];
  let v = 0, sh = 0, len = 0;
  for (let i = header; i < buf.length; i++) {
    v += (buf[i] & 0x7f) * 2 ** sh; len++; sh += 7;
    if ((buf[i] & 0x80) === 0) { toks.push({ v, len }); v = 0; sh = 0; len = 0; }
  }
  return { header, fixed: s.fixed_bytes, toks };
}

/** Front end: byte queue + tokenizer + token queue, stepped once per clock edge. */
class FrontEnd {
  readonly BQ: number; readonly TQ: number;
  ptr = 0; bcnt = 0; tokMode = false; tcnt = 0; tokIdx = 0; // next token index to enter the queue
  private ends: number[]; // stream index of the last byte of token k
  constructor(readonly W: number, readonly K: number, readonly n: number, header: number, toks: Tok[]) {
    this.BQ = 2 * W; this.TQ = 2 * W + K;
    this.ends = []; let p = header; for (const t of toks) { p += t.len; this.ends.push(p - 1); }
  }
  /** byte-queue head index (stream position) */
  get head(): number { return this.ptr - this.bcnt; }
  /** one edge: hdrPop (0/1) in byte mode, tokPop tokens in token mode */
  step(hdrPop: number, tokPop: number, setTokMode: boolean): void {
    const W = this.W;
    const inReady = this.bcnt + W <= this.BQ;
    let bpop = 0, nt = 0;
    if (this.tokMode) {
      if (this.tcnt + W <= this.TQ) {
        bpop = Math.min(this.bcnt, W);
        const to = this.head + bpop - 1;   // tokens whose last byte is taken this cycle
        while (this.tokIdx + nt < this.ends.length && this.ends[this.tokIdx + nt] <= to) nt++;
      }
    } else bpop = hdrPop;
    this.bcnt -= bpop;
    if (inReady && this.ptr < this.n) { const nb = Math.min(W, this.n - this.ptr); this.ptr += nb; this.bcnt += nb; }
    this.tcnt = this.tcnt - tokPop + nt; this.tokIdx += nt;
    if (setTokMode) this.tokMode = true;
  }
}

// ---------------- scp4d_tdec_w ----------------
export interface TdecWModel {
  W: number; cycles: number; header_cycles: number; clear_wait: number; payload_cycles: number; tail: number;
  end_token: number; end_bank: number; end_frame: number; end_steps: number; starved: number; steps: number; lanes: number;
}
export function tdecWCycleModel(buf: Uint8Array, W: number): TdecWModel {
  const s = streamStructure(buf);
  const { header, fixed, toks } = payloadTokens(buf);
  const P = W, K = W, D = s.D, T = s.T, last = s.predictor === 1, sweepMode = !last;
  const fe = new FrontEnd(W, K, buf.length, header, toks);
  const clrLen = Math.ceil(D / P);
  // stream walk state
  type St = "HEAD" | "DENSE" | "SPFIRST" | "SPQ" | "SPGAP" | "SWEEP";
  let st: St = "HEAD", ei = 0, nxt = 0, left = 0, fr = 0, allDense = false, hdrDone = 0;
  let clrActive = false, clrCnt = 0, clrDone = false;
  let tq = 0; // index of the token at the queue head
  let edge = 0, hdrCycles = 0, clearWait = 0, pay = 0;
  const r = { end_token: 0, end_bank: 0, end_frame: 0, end_steps: 0, starved: 0, steps: 0, lanes: 0 };
  let lastAdvEdge = -1;
  while (lastAdvEdge < 0) {
    if (edge > 50 * buf.length + 100000) throw new Error("tdec_w model did not finish");
    let hdrPop = 0, tokPop = 0, setTok = false;
    const nextClr = () => { if (clrActive) { if (clrCnt === clrLen - 1) { clrActive = false; clrDone = true; } else clrCnt++; } };
    if (hdrDone < header) {
      hdrCycles++;
      if (!fe.tokMode && fe.bcnt > 0) {
        hdrPop = 1;
        if (hdrDone === fixed - 1) { nextClr(); clrActive = true; clrCnt = 0; hdrDone++; fe.step(1, 0, false); edge++; continue; }
        if (hdrDone === header - 1) { setTok = true; allDense = buf[header - 1] === 1; st = allDense ? "DENSE" : "HEAD"; }
        hdrDone++;
      }
      nextClr(); fe.step(hdrPop, 0, setTok); edge++; continue;
    }
    if (!clrDone) { clearWait++; nextClr(); fe.step(0, 0, false); edge++; continue; }
    // issue chain
    pay++;
    const avail = Math.min(fe.tcnt, K);
    let k = 0, steps = 0, used = 0, stop = false, why = "steps", adv = false;
    for (let j = 0; j < W && !stop; j++) {
      const needsTok: boolean = (st as St) !== "SWEEP";
      if (needsTok && k >= avail) { stop = true; why = "token"; break; }
      const t: Tok | undefined = needsTok ? toks[tq + k] : undefined;
      let el = -1;
      if (st === "SWEEP") el = ei;
      else if (st === "SPQ") el = nxt;
      else if (st === "DENSE") { const q = t!.v; el = (sweepMode || q !== 0) ? ei : -1; }
      if (el >= 0 && (used & (1 << (el & (P - 1))))) { stop = true; why = "bank"; break; }
      steps++; if (needsTok) k++;
      if (el >= 0) { used |= 1 << (el & (P - 1)); r.lanes++; }
      switch (st) {
        case "HEAD": {
          const n = Math.floor(t!.v / 2); ei = 0;
          if (t!.v % 2 === 1) st = "DENSE";
          else if (n === 0) { if (last) adv = true; else { nxt = D; st = "SWEEP"; } }
          else { left = n - 1; st = "SPFIRST"; }
          break;
        }
        case "SPFIRST": nxt = t!.v; st = (sweepMode && nxt !== ei) ? "SWEEP" : "SPQ"; break;
        case "SWEEP": ei++; if (ei === nxt) { if (nxt === D) adv = true; else st = "SPQ"; } break;
        case "SPQ": {
          const eof = last ? left === 0 : (left === 0 && nxt === D - 1);
          ei = nxt + 1;
          if (left !== 0) st = "SPGAP"; else if (eof) adv = true; else { nxt = D; st = "SWEEP"; }
          break;
        }
        case "SPGAP": { const g: number = ei + t!.v; nxt = g; left--; st = (sweepMode && g !== ei) ? "SWEEP" : "SPQ"; break; }
        case "DENSE": { const eof = ei === D - 1; ei++; if (eof) adv = true; break; }
      }
      if (adv) { stop = true; why = "frame"; }
    }
    r.steps += steps; if (steps === 0) r.starved++;
    if (why === "token") r.end_token++; else if (why === "bank") r.end_bank++; else if (why === "frame") r.end_frame++; else r.end_steps++;
    tq += k; tokPop = k;
    if (adv) { fr++; ei = 0; st = allDense ? "DENSE" : "HEAD"; if (fr === T) lastAdvEdge = edge; }
    fe.step(0, tokPop, false); edge++;
  }
  return { W, cycles: lastAdvEdge + 1 + TDECW_TAIL, header_cycles: hdrCycles, clear_wait: clearWait, payload_cycles: pay, tail: TDECW_TAIL, ...r };
}

// ---------------- scp4d_rdec_w ----------------
export interface RdecWModel {
  W: number; cycles: number; header_cycles: number; clear_wait: number; parse_cycles: number; pair_cycles: number; starve_cycles: number;
  fan_cycles: number; settle_cycles: number; flush_cycles: number; tail: number;
}
export const RDECW_FW = 4;
export function rdecWCycleModel(buf: Uint8Array, W: number, prog: RtlProgram | null): RdecWModel {
  const s = streamStructure(buf);
  const { header, fixed, toks } = payloadTokens(buf);
  const K = W >= 2 ? 2 : 1, D = s.D, T = s.T, rel = s.relations === 1 && !!prog;
  const fe = new FrontEnd(W, K, buf.length, header, toks);
  type St = "HEAD" | "DENSE" | "SPFIRST" | "SPQ" | "SPGAP" | "FAN" | "FWAIT" | "F0" | "FLIST";
  let st: St = "HEAD", ret: St = "HEAD", ei = 0, nxt = 0, left = 0, fr = 0, allDense = false, hdrDone = 0;
  let clrActive = false, clrCnt = 0, clrDone = false, fanLeft = 0, wcnt = 0, flushLeft = 0;
  let dirty = new Set<number>();
  let tq = 0, edge = 0, lastAdvEdge = -1;
  const r = { header_cycles: 0, clear_wait: 0, parse_cycles: 0, pair_cycles: 0, starve_cycles: 0, fan_cycles: 0, settle_cycles: 0, flush_cycles: 0 };
  const frameEnd = (): boolean => { if (rel) { wcnt = 0; st = "FWAIT"; return false; } return true; };
  // event at processing position p; returns true when the frame advances now
  const issue = (p: number, lastInFrame: boolean, cont: St): boolean => {
    if (!rel) { if (lastInFrame) return true; st = cont; return false; }
    const e = prog!.order[p], ti = prog!.targetIdx[e];
    if (ti >= 0) { dirty.add(ti); if (lastInFrame) return frameEnd(); st = cont; return false; }
    const fc = prog!.fanCount[e];
    if (fc > 0) { for (const x of prog!.fanTargets[e]) dirty.add(x); fanLeft = fc; ret = lastInFrame ? "FWAIT" : cont; st = "FAN"; return false; }
    if (lastInFrame) return frameEnd();
    st = cont; return false;
  };
  while (lastAdvEdge < 0) {
    if (edge > 50 * buf.length + 50 * T * D + 100000) throw new Error("rdec_w model did not finish");
    const nextClr = () => { if (clrActive) { if (clrCnt === D - 1) { clrActive = false; clrDone = true; } else clrCnt++; } };
    if (hdrDone < header) {
      r.header_cycles++;
      let setTok = false, pop = 0;
      if (!fe.tokMode && fe.bcnt > 0) {
        pop = 1;
        if (hdrDone === fixed - 1) { nextClr(); clrActive = true; clrCnt = 0; hdrDone++; fe.step(1, 0, false); edge++; continue; }
        if (hdrDone === header - 1) { setTok = true; allDense = buf[header - 1] === 1; st = allDense ? "DENSE" : "HEAD"; }
        hdrDone++;
      }
      nextClr(); fe.step(pop, 0, setTok); edge++; continue;
    }
    const cd = clrDone;
    nextClr();
    const s0 = st as St;
    const frameState = s0 === "HEAD" || s0 === "DENSE" || s0 === "SPFIRST" || s0 === "SPQ" || s0 === "SPGAP";
    let pop = 0, adv = false;
    if (frameState && !cd) r.clear_wait++;
    else if (frameState) {
      const avail = Math.min(fe.tcnt, K);
      if (avail === 0) r.starve_cycles++;
      else {
        r.parse_cycles++; pop = 1;
        const t = toks[tq];
        switch (st as St) {
          case "HEAD": {
            const n = Math.floor(t.v / 2); ei = 0;
            if (t.v % 2 === 1) st = "DENSE";
            else if (n === 0) adv = frameEnd();
            else { left = n - 1; st = "SPFIRST"; if (avail >= 2) { pop = 2; nxt = toks[tq + 1].v; st = "SPQ"; } }
            break;
          }
          case "SPFIRST": nxt = t.v; st = "SPQ"; break;
          case "SPQ": {
            const p = nxt; ei = nxt + 1;
            if (left !== 0 && avail >= 2) { pop = 2; issue(p, false, "SPQ"); nxt = ei + toks[tq + 1].v; left--; }
            else adv = issue(p, left === 0, "SPGAP");
            break;
          }
          case "SPGAP": nxt = ei + t.v; left--; st = "SPQ"; break;
          case "DENSE": {
            const p = ei, q = t.v; ei++;
            if (p === D - 1) adv = q !== 0 ? issue(p, true, "DENSE") : frameEnd();
            else if (q !== 0) issue(p, false, "DENSE");
            break;
          }
          default: break;
        }
        if (pop === 2) r.pair_cycles++;
      }
    } else if (s0 === "FAN") {
      r.fan_cycles++; fanLeft--;
      if (fanLeft === 0) { if ((ret as St) === "FWAIT") { wcnt = 0; st = "FWAIT"; } else st = ret; }
    } else if (st === "FWAIT") {
      r.settle_cycles++;
      if (wcnt === RDECW_FW - 1) {
        if (fr === 0) { st = "F0"; flushLeft = prog!.nT; }
        else if (dirty.size === 0) adv = true;
        else { st = "FLIST"; flushLeft = dirty.size; }
      } else wcnt++;
    } else if (st === "F0" || st === "FLIST") {
      r.flush_cycles++; flushLeft--; if (flushLeft === 0) adv = true;
    }
    tq += pop;
    if (adv) { fr++; ei = 0; dirty = new Set(); st = allDense ? "DENSE" : "HEAD"; if (fr === T) lastAdvEdge = edge; }
    fe.step(0, pop, false); edge++;
  }
  return { W, cycles: lastAdvEdge + 1 + RDECW_TAIL, ...r, tail: RDECW_TAIL };
}

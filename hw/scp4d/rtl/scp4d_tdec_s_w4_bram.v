// TEST ONLY. v0.1.22 decoder variant. Same schedule as scp4d_tdec_s.
// The front end is scp4d_fe_r_share (one token-queue shift instead of K+1 copies).
// Bank memories mh1/mh2 stay synchronous block RAM. scp4d_tdec_s.v is unchanged.
`timescale 1ns/1ps
//
// Same function, ports, stream scope, outputs (per frame), error codes and header parser as v0.1.13's
// scp4d_tdec_w.v and v0.1.17's scp4d_tdec_r.v (both unchanged, sha-pinned): rank 0, relations off,
// zero / last / linear hold; integer codes bit-exact with the v0.1.10 model; relations or a low-rank
// base are REJECTED at the header with unsupported = 1. v0.1.17 left the clock limited by the issue
// chain's four serial steps (token view -> state decode -> bank check -> next-element compare). This
// variant splits that chain into two pipeline stages joined by a record queue:
//   stage 1, token classifier: every queued token has a fixed role per cycle (a head token alone;
//     in a sparse frame gap / first index and q alternate from a registered phase; in a dense frame
//     one element per token), so the stage is a narrow add chain plus independent per-token flags
//     (range checks precomputed in scp4d_fe_r, v0.1.17, unchanged). It turns tokens into element
//     RECORDS (event element, q, limit, eof / error) and pops the token queue.
//   stage 2, bank issuer: takes up to P records per cycle from the record queue and issues output
//     values to the P banks (last hold: event records in order until a bank repeats; zero / linear
//     hold: the aligned block of P elements around a cursor, events matched by element).
//   Errors found by the classifier travel as records, so every value before the failing token is
//     still issued and err is raised when the issuer reaches the error (as scp4d_tdec_w: steps
//     before a failing step are issued, the failing step is not, except the dense count check's
//     last element).
// CYCLES CHANGE (exact model: scripts/scp-v0118-rtl-model.ts): the classifier runs during the
// background state clear, a head token takes a classifier cycle of its own, records spend one cycle
// in a register before the queue, the issuer is limited by bank conflicts / its P-record window and
// the sweep is issued in aligned blocks. Values and per-frame outputs are unchanged (checked against
// scp4d_tdec_w and scp4d_tdec_r run on the same beats).
// Banks are scp4d_tdec_r's: P = W banks of state memory (element e in bank e mod P), each an A (sync
// read) / B (execute, write, forward) pipeline; outputs are P lanes per cycle.
//
// Plain Verilog-2005. No floating point, no division, no hashing, no initial blocks.
`default_nettype none
module scp4d_tdec_s_w4_bram #(
  parameter integer W      = 2,    // input bytes / chain steps / banks per cycle: 1, 2 or 4
  parameter integer ADDR_W = 11,   // max D = 2^ADDR_W elements per frame
  parameter integer G_MAX  = 16
) (
  input  wire                  clk,
  input  wire                  rst,
  input  wire [8*W-1:0]        in_data,
  input  wire [2:0]            in_nbytes,
  input  wire                  in_valid,
  output wire                  in_ready,
  output reg  [W-1:0]          out_valid,
  output reg  [W*ADDR_W-1:0]   out_elem,
  output reg  [W*32-1:0]       out_code,
  output reg  [W-1:0]          out_event,
  output reg                   out_eof,
  output reg                   done,
  output reg                   err,
  output reg                   unsupported,
  output reg  [4:0]            err_code,
  output reg  [31:0]           hdr_T,
  output reg  [ADDR_W:0]       hdr_D,
  output reg  [4:0]            hdr_G,
  output reg  [1:0]            hdr_pred,
  output reg  [31:0]           consumed      // stream bytes retired by the decoder
);
  localparam integer P   = W;
  localparam integer LP  = (W >= 4) ? 2 : (W >= 2) ? 1 : 0;
  localparam integer BA  = ADDR_W - LP;     // bank address width
  localparam integer K   = W;
  localparam [ADDR_W:0] MAXD = 1 << ADDR_W;

  localparam [4:0] E_MAGIC = 5'd1, E_VERSION = 5'd2, E_T0 = 5'd3, E_DSIZE = 5'd4, E_G = 5'd5,
                   E_HVARINT = 5'd6, E_VERDICT = 5'd7, E_RANK = 5'd8, E_REL = 5'd9, E_PRED = 5'd10,
                   E_FW = 5'd11, E_PVARINT = 5'd13, E_QWIDTH = 5'd14, E_QZERO = 5'd15,
                   E_INDEX = 5'd16, E_COUNT = 5'd17, E_OVF = 5'd18;
  localparam [4:0] S_FIX = 5'd0, S_EPS = 5'd1, S_G = 5'd2, S_TIMES = 5'd3, S_MFLAG = 5'd4,
                   S_STEPS = 5'd5, S_VERD = 5'd6, S_RANK = 5'd7, S_REL = 5'd8, S_PRED = 5'd9,
                   S_FW = 5'd10, S_LAYOUT = 5'd11, S_HEAD = 5'd12, S_DENSE = 5'd13,
                   S_SPFIRST = 5'd14, S_SPQ = 5'd15, S_SPGAP = 5'd16, S_SWEEP = 5'd17,
                   S_DRAIN = 5'd18, S_DONE = 5'd19, S_ERR = 5'd20;
  // why the chain ended (debug / measurement only)
  localparam [2:0] W_NONE = 3'd0, W_TOKEN = 3'd1, W_BANK = 3'd2, W_FRAME = 3'd3, W_STEPS = 3'd4, W_FAIL = 3'd5;

  (* fsm_encoding = "none" *) reg [4:0] state;   // not re-encoded by yosys fsm (keeps synthesis tractable at W = 4)
  reg       ovf_q;   // registered lane overflow (sticky)

  // ---------------- front end ----------------
  localparam integer AW = ADDR_W;
  localparam integer O_DMG = 0, O_LO = AW + 2, O_GE = 2*AW + 3, O_NM1 = 2*AW + 4, O_N = 3*AW + 5,
                     O_HBIG = 4*AW + 6, O_HZ = 4*AW + 7, O_DN = 4*AW + 8, O_BIG = 4*AW + 9, O_NZ = 4*AW + 10,
                     O_Q = 4*AW + 11, O_LONG = 4*AW + 43, O_LEN = 4*AW + 44, EW = 4*AW + 47;
  wire        b_avail; wire [7:0] b_data; reg tok_mode;
  wire [4:0]  t_cnt; wire [EW*K-1:0] t_ent;
  reg  [2:0]  t_pop;
  reg  [ADDR_W:0] dm1;     // hdr_D − 1 (registered with hdr_D)
  wire hdr_state = (state <= S_LAYOUT);
  wire b_take = hdr_state && b_avail;
  scp4d_fe_r_share #(.W(W), .K(K), .ADDR_W(ADDR_W)) fe (
    .clk(clk), .rst(rst), .in_data(in_data), .in_nbytes(in_nbytes), .in_valid(in_valid), .in_ready(in_ready),
    .b_avail(b_avail), .b_data(b_data), .b_pop(b_take),
    .tok_mode(tok_mode), .lim_D(hdr_D), .lim_Dm1(dm1), .t_cnt(t_cnt), .t_ent(t_ent), .t_pop(t_pop));

  // consumed + (lengths of the first p queued tokens), p = 0..K, from registered state only
  reg [31:0] cons_p [0:K];
  reg [31:0] cum;
  integer cp, cq;
  always @(*) begin
    cum = 32'd0;
    for (cp = 0; cp <= K; cp = cp + 1) begin
      cons_p[cp] = consumed + cum;
      if (cp < K) cum = cum + {29'd0, t_ent[EW*cp + O_LEN +: 3]};
    end
  end

  // ---------------- header registers ----------------
  reg [4:0]          bidx;
  reg [7:0]          fld_lo;
  reg [ADDR_W:0]     dacc;
  reg                dbig;
  reg [ADDR_W+3:0]   cnt;
  reg [ADDR_W+3:0]   eps_last;
  reg [31:0]         vcount;
  reg [2:0]          hvb;
  reg                all_dense;

  reg                clr_active, clr_done;
  reg [BA-1:0]       clr_cnt, clr_last;


  wire mode_last = (hdr_pred == 2'd1);
  wire mode_lin  = (hdr_pred == 2'd2);
  wire sweep_mode = !mode_last;

  wire [15:0]        fld   = {b_data, fld_lo};
  wire [ADDR_W+16:0] prod  = dacc * fld;
  wire               pbig  = dbig || (prod > {{16{1'b0}}, MAXD});
  localparam integer PM1I = P - 1;
  localparam [ADDR_W:0] PM1 = PM1I[ADDR_W:0];
  /* verilator lint_off UNUSEDSIGNAL */
  wire [ADDR_W:0]    dplus = prod[ADDR_W:0] + PM1;   // only [ADDR_W-1:LP] is used: ceil(D / P)
  /* verilator lint_on UNUSEDSIGNAL */


  // =====================================================================================
  // Stage 1: TOKEN CLASSIFIER (combinational over the first K queued tokens; registered state only)
  // =====================================================================================
  // Every token position has a fixed role per cycle: a head token is classified alone; in a sparse frame
  // gap (first index included) and q alternate from the registered phase ph (ph = 0: tokens 0, 2 are gaps
  // A, B; ph = 1: tokens 1, 3 are gaps A, B); in a dense frame each token is one element. All per-token
  // facts are formed in parallel; the only arithmetic chain is gap A's add feeding gap B's range check
  // (K = 4). The pop count is a priority encode of "token i is queued" and "token i ends the cycle".
  // Output: up to K element RECORDS per cycle in fixed slots (dense: slot = token; sparse: slot = pair),
  // registered into rec_r and pushed into the record queue on the next edge.
  //   record (RW bits, LSB first): lim (ADDR_W+1: elements < lim of this frame are resolved),
  //   e (ADDR_W: event element), q (32), ev, eof (frame ends with this record), er (error), code (5)
  localparam [2:0] C_IDLE = 3'd0, C_HEAD = 3'd1, C_SP = 3'd2, C_DENSE = 3'd3, C_END = 3'd4, C_ERR = 3'd5;
  localparam integer R_LIM = 0, R_E = AW + 1, R_Q = 2*AW + 1, R_EV = 2*AW + 33, R_EOF = 2*AW + 34,
                     R_ER = 2*AW + 35, R_CODE = 2*AW + 36, RW = 2*AW + 41;
  localparam integer RQ = 3 * W;                    // record queue depth
  localparam [5:0] RQ6 = RQ[5:0], K6 = K[5:0];
  reg [2:0]      cstate;
  reg            ph;           // C_SP: 0 = token 0 is a gap / first index, 1 = token 0 is a q
  reg [ADDR_W:0] bp;           // C_SP: base element of the next gap (last event + 1; 0 at frame start)
  reg [ADDR_W:0] nxt;          // C_SP, ph = 1: element of the pending q
  reg [ADDR_W:0] left;         // C_SP: gaps (first index included) still to come in this sparse frame
  reg [ADDR_W:0] dbase;        // C_DENSE: element of token 0
  reg [ADDR_W:0] frem;         // C_DENSE: head count − nonzero q seen so far
  reg            nbig;         // head count > D
  reg [31:0]     fr;           // classifier frame
  reg            fr_last;      // fr + 1 == hdr_T (registered)
  reg [RW-1:0]   rec_r [0:K-1];
  reg [4:0]      rec_n;
  reg [RW-1:0]   rq [0:RQ-1];
  reg [4:0]      rq_cnt;

  wire c_room = ({1'b0, rq_cnt} + {1'b0, rec_n} + K6) <= RQ6;
  wire c_run  = ((cstate == C_HEAD) || (cstate == C_SP) || (cstate == C_DENSE)) && !err && c_room;

  function [RW-1:0] mkrec(input [ADDR_W:0] lim, input [ADDR_W:0] e, input [31:0] q, input ev, input eof, input er, input [4:0] code);
    mkrec = {code, er, eof, ev, q, e[ADDR_W-1:0], lim};
  endfunction

  // per-token fields (token i = the i-th token popped this cycle)
  reg [K-1:0]    tl, qbig, qnz, tdn, thz, thbig, tge, isq, tv;
  reg [31:0]     tq32 [0:K-1];
  reg [ADDR_W:0] tn [0:K-1];
  reg [ADDR_W:0] tlo [0:K-1];
  reg [ADDR_W+1:0] tdmg [0:K-1];
  // sparse body: gaps A / B
  reg            hasA, hasB, ftA, ftB;
  reg [ADDR_W:0] loA, loB, xeA, xeB;
  reg [ADDR_W+1:0] dmgA, dmgB;
  reg [ADDR_W:0] eq [0:K-1];          // element of q token i
  reg [ADDR_W:0] xs [0:K-1];          // base of gap token i (its error bound)
  reg [ADDR_W:0] gbf [0:K-1];         // gaps before token i (this cycle)
  // dense
  reg [ADDR_W:0] de [0:K-1];
  reg [ADDR_W:0] pc [0:K-1];          // nonzero q among dense tokens 0..i
  // per-token outcome
  reg [K-1:0]    fl, st, eo, cbad, proc;
  reg [RW-1:0]   trec [0:K-1];        // record token i would produce
  reg [K-1:0]    tprod;               // token i produces a record
  reg [2:0]      c_k;
  reg [4:0]      c_rn;
  reg [RW-1:0]   c_rec [0:K-1];
  reg            c_adv, c_fail, c_blk;
  reg [2:0]      n_cstate;
  reg            n_ph, n_nbig;
  reg [ADDR_W:0] n_bp, n_nxt, n_left, n_dbase, n_frem, gdone, pcs;
  integer i, s;
  /* verilator lint_off WIDTHEXPAND */
  /* verilator lint_off WIDTHTRUNC */
  always @(*) begin
    // ---- token fields, roles ----
    for (i = 0; i < K; i = i + 1) begin
      tl[i] = t_ent[EW*i + O_LONG]; tq32[i] = t_ent[EW*i + O_Q +: 32]; qnz[i] = t_ent[EW*i + O_NZ]; qbig[i] = t_ent[EW*i + O_BIG];
      tdn[i] = t_ent[EW*i + O_DN]; thz[i] = t_ent[EW*i + O_HZ]; thbig[i] = t_ent[EW*i + O_HBIG]; tge[i] = t_ent[EW*i + O_GE];
      tn[i] = t_ent[EW*i + O_N +: ADDR_W+1]; tlo[i] = t_ent[EW*i + O_LO +: ADDR_W+1]; tdmg[i] = t_ent[EW*i + O_DMG +: ADDR_W+2];
      tv[i] = (i < t_cnt);
      isq[i] = ph ? ((i % 2) == 0) : ((i % 2) == 1);
    end
    // ---- sparse body: gap A at token ph, gap B at token ph + 2 ----
    hasA = 1'b0; hasB = 1'b0; loA = 0; loB = 0; dmgA = 0; dmgB = 0; ftA = 1'b0; ftB = 1'b0;
    for (i = 0; i < K; i = i + 1) begin
      if (i == (ph ? 1 : 0)) begin hasA = 1'b1; loA = tlo[i]; dmgA = tdmg[i]; ftA = tl[i] || tge[i]; end
      if (i == (ph ? 3 : 2)) begin hasB = 1'b1; loB = tlo[i]; dmgB = tdmg[i]; ftB = tl[i] || tge[i]; end
    end
    xeA = bp + loA;                      // element of the q after gap A
    xeB = xeA + loB + 1'b1;              // element of the q after gap B
    for (i = 0; i < K; i = i + 1) begin
      // q element / gap base / gaps before, by position (ph selects)
      eq[i] = ph ? ((i == 0) ? nxt : (i == 2) ? xeA : xeB) : ((i == 1) ? xeA : xeB);
      xs[i] = ph ? ((i == 1) ? bp : xeA + 1'b1) : ((i == 0) ? bp : xeA + 1'b1);
      gbf[i] = ph ? ((i <= 1) ? 0 : (i <= 3) ? 1 : 2) : ((i == 0) ? 0 : (i <= 2) ? 1 : 2);
      de[i] = dbase + i;
    end
    pcs = 0;
    for (i = 0; i < K; i = i + 1) begin pcs = pcs + qnz[i]; pc[i] = pcs; end
    // ---- per-token fail (fl), ends-the-frame (eo), ends-the-cycle (st), record (trec, tprod) ----
    for (i = 0; i < K; i = i + 1) begin
      fl[i] = 1'b0; eo[i] = 1'b0; cbad[i] = 1'b0; tprod[i] = 1'b0; trec[i] = {RW{1'b0}};
      case (cstate)
        C_HEAD: if (i == 0) begin
          if (tl[0]) begin fl[0] = 1'b1; tprod[0] = 1'b1; trec[0] = mkrec(0, 0, 0, 1'b0, 1'b0, 1'b1, E_PVARINT); end
          else if (tdn[0]) ;
          else if (thz[0]) begin eo[0] = 1'b1; tprod[0] = 1'b1; trec[0] = mkrec(hdr_D, 0, 0, 1'b0, 1'b1, 1'b0, 5'd0); end
          else if (thbig[0]) begin fl[0] = 1'b1; tprod[0] = 1'b1; trec[0] = mkrec(0, 0, 0, 1'b0, 1'b0, 1'b1, E_INDEX); end
        end
        C_SP: if (isq[i]) begin
          fl[i] = tl[i] || qbig[i] || !qnz[i];
          eo[i] = !fl[i] && (left == gbf[i]);
          tprod[i] = 1'b1;
          trec[i] = fl[i] ? mkrec(eq[i], 0, 0, 1'b0, 1'b0, 1'b1, tl[i] ? E_PVARINT : qbig[i] ? E_QWIDTH : E_QZERO)
                          : mkrec(eo[i] ? hdr_D : eq[i] + 1'b1, eq[i], tq32[i], 1'b1, eo[i], 1'b0, 5'd0);
        end else begin
          // gap: base + gap >= D  <=>  base > (D − 1) − gap (gap A: base = bp; gap B: base = xeA + 1)
          fl[i] = (i == (ph ? 1 : 0)) ? (ftA || ($signed({1'b0, bp}) > $signed(dmgA)))
                                      : (ftB || ($signed({1'b0, xeA}) >= $signed(dmgB)));
          tprod[i] = fl[i];
          trec[i] = mkrec(xs[i], 0, 0, 1'b0, 1'b0, 1'b1, tl[i] ? E_PVARINT : E_INDEX);
        end
        C_DENSE: begin
          fl[i] = tl[i] || qbig[i];
          cbad[i] = !fl[i] && (de[i] == dm1) && !all_dense && (nbig || (pc[i] != frem));
          fl[i] = fl[i] || cbad[i];
          eo[i] = !fl[i] && (de[i] == dm1);
          tprod[i] = 1'b1;
          trec[i] = (tl[i] || qbig[i]) ? mkrec(de[i], 0, 0, 1'b0, 1'b0, 1'b1, tl[i] ? E_PVARINT : E_QWIDTH)
                  : cbad[i] ? mkrec(hdr_D, de[i], tq32[i], qnz[i], 1'b0, 1'b1, E_COUNT)       // last element still issued
                  : mkrec(eo[i] ? hdr_D : de[i] + 1'b1, de[i], tq32[i], qnz[i], eo[i], 1'b0, 5'd0);
        end
        default: ;
      endcase
      st[i] = fl[i] || eo[i] || (cstate == C_HEAD);
    end
    // ---- pop count: token i is popped if queued and no earlier token ended the cycle ----
    c_blk = !c_run; c_k = 3'd0; c_adv = 1'b0; c_fail = 1'b0;
    for (i = 0; i < K; i = i + 1) begin
      proc[i] = !c_blk && tv[i];
      if (proc[i]) begin c_k = c_k + 3'd1; c_adv = c_adv | eo[i]; c_fail = c_fail | fl[i]; end
      c_blk = c_blk || !tv[i] || st[i];
    end
    // ---- records into fixed slots ----
    c_rn = 5'd0;
    for (s = 0; s < K; s = s + 1) begin
      c_rec[s] = {RW{1'b0}};
      for (i = 0; i < K; i = i + 1)
        if (proc[i] && tprod[i] && (((cstate == C_DENSE) && i == s) || ((cstate == C_HEAD) && i == 0 && s == 0)
            || ((cstate == C_SP) && (ph ? ((i + 1) / 2 == s) : (i / 2 == s))))) begin
          c_rec[s] = trec[i]; c_rn = c_rn + 5'd1;
        end
    end
    // ---- next classifier state ----
    n_cstate = cstate; n_ph = ph; n_bp = bp; n_nxt = nxt; n_left = left; n_dbase = dbase; n_frem = frem; n_nbig = nbig;
    gdone = 0;
    for (i = 0; i < K; i = i + 1) if (proc[i] && !isq[i]) gdone = gdone + 1'b1;
    case (cstate)
      C_HEAD: if (proc[0] && !tl[0]) begin
        if (tdn[0]) begin n_cstate = C_DENSE; n_dbase = 0; n_frem = tn[0]; n_nbig = thbig[0]; end
        else if (!thz[0] && !thbig[0]) begin n_cstate = C_SP; n_ph = 1'b0; n_bp = 0; n_left = tn[0]; end
      end
      C_SP: begin
        n_ph = ph ^ c_k[0];
        n_left = left - gdone;
        // last popped token: gap A / q after A / gap B / q after B
        if (c_k == (ph ? 3'd2 : 3'd1)) begin n_nxt = xeA; n_bp = xeA + 1'b1; end
        else if (c_k == (ph ? 3'd3 : 3'd2)) n_bp = xeA + 1'b1;
        else if (c_k == (ph ? 3'd4 : 3'd3)) begin n_nxt = xeB; n_bp = xeB + 1'b1; end
        else if (!ph && c_k == 3'd4) n_bp = xeB + 1'b1;
      end
      C_DENSE: begin
        n_dbase = dbase + c_k;
        n_frem = frem - ((c_k == 3'd0) ? 0 : pc[c_k - 1]);
      end
      default: ;
    endcase
    if (c_fail) n_cstate = C_ERR;
    else if (c_adv) begin
      n_cstate = fr_last ? C_END : (all_dense ? C_DENSE : C_HEAD);
      n_dbase = 0; n_ph = 1'b0; n_bp = 0;
    end
  end
  /* verilator lint_on WIDTHTRUNC */
  /* verilator lint_on WIDTHEXPAND */
  always @(*) t_pop = c_k;

  // =====================================================================================
  // Record queue: pop-late shift queue (candidate per issuer pop count, from registered state only)
  // =====================================================================================
  integer rj;

  // =====================================================================================
  // Stage 2: BANK ISSUER (combinational over the first P queued records)
  // =====================================================================================
  // last hold: each event record goes to its bank's lane, in order, until a bank is taken twice.
  // zero / linear hold (sweep): the aligned block of P elements around `cur` is issued, one element per
  // bank, up to the last queued record's limit; an element is an event when a queued record names it.
  // A cycle never crosses a frame end or an error record.
  reg [ADDR_W:0] cur;          // sweep: next element of the frame to issue
  reg [ADDR_W:0] cbe;          // sweep: end of cur's aligned block ((cur & ~(P − 1)) + P, registered)
  reg [31:0]     ifr;          // issuer frame
  reg            ilast, irun;
  // err is not part of the issue decision: it gates the lanes, eof and bookkeeping at the registers
  wire           i_go = clr_done && irun;
  reg [2:0]      i_p;
  reg            i_eof, i_fail, i_im, i_stop;
  reg [4:0]      i_code;
  reg [P-1:0]    i_m, i_used, i_bsel;
  reg [ADDR_W:0] lmax, bb, n_cur, elb;
  reg [ADDR_W-1:0] rej;
  reg [P-1:0]    i_v, iss_v, iss_ev;
  reg [P*ADDR_W-1:0] iss_e;
  reg [P*32-1:0] iss_q;
  integer j, m, b, ii;
  localparam [ADDR_W:0] PW  = P;
  /* verilator lint_off WIDTHEXPAND */
  /* verilator lint_off WIDTHTRUNC */
  always @(*) begin
    i_p = 3'd0; i_eof = 1'b0; i_fail = 1'b0; i_code = 5'd0; i_stop = 1'b0; i_used = {P{1'b0}};
    i_v = {P{1'b0}}; iss_ev = {P{1'b0}}; iss_e = {P*ADDR_W{1'b0}}; iss_q = {P*32{1'b0}};
    i_im = i_go; i_bsel = {P{1'b0}}; rej = 0; elb = 0;
    for (j = 0; j < P; j = j + 1) begin
      i_m[j] = i_im && (j < rq_cnt);
      if (!(j < rq_cnt) || rq[j][R_EOF] || rq[j][R_ER]) i_im = 1'b0;
    end
    bb = cur & ~PM1; lmax = cur; n_cur = cur;
    if (mode_last) begin
      for (j = 0; j < P; j = j + 1) if (i_m[j] && !i_stop) begin
        rej = rq[j][R_E +: ADDR_W];
        i_bsel = {P{1'b0}};
        for (m = 0; m < P; m = m + 1) if ((rej[1:0] & PM1[1:0]) == m) i_bsel[m] = 1'b1;
        if (rq[j][R_EV] && ((i_used & i_bsel) != {P{1'b0}})) i_stop = 1'b1;
        else begin
          i_p = i_p + 3'd1;
          if (rq[j][R_EV])
            for (m = 0; m < P; m = m + 1) if (i_bsel[m]) begin
              i_used[m] = 1'b1; i_v[m] = 1'b1; iss_ev[m] = 1'b1;
              iss_e[ADDR_W*m +: ADDR_W] = rej; iss_q[32*m +: 32] = rq[j][R_Q +: 32];
            end
          if (rq[j][R_EOF]) i_eof = 1'b1;
          if (rq[j][R_ER]) begin i_fail = 1'b1; i_code = rq[j][R_CODE +: 5]; end
        end
      end
    end else begin
      // records are in element order within a frame (limits never decrease), so the last valid one
      // carries the largest limit, and a record is fully issued this cycle iff its limit <= block end
      for (j = 0; j < P; j = j + 1) if (i_m[j]) lmax = rq[j][R_LIM +: ADDR_W+1];
      for (b = 0; b < P; b = b + 1) begin
        elb = bb | b;
        if ((b >= (cur & PM1)) && (elb < lmax)) begin
          i_v[b] = 1'b1; iss_e[ADDR_W*b +: ADDR_W] = elb[ADDR_W-1:0];
          for (j = 0; j < P; j = j + 1)
            if (i_m[j] && rq[j][R_EV] && (rq[j][R_E +: ADDR_W] == elb[ADDR_W-1:0])) begin
              iss_ev[b] = 1'b1; iss_q[32*b +: 32] = rq[j][R_Q +: 32];
            end
        end
      end
      if (cbe <= lmax) n_cur = cbe; else if (lmax > cur) n_cur = lmax; else n_cur = cur;
      for (j = 0; j < P; j = j + 1) if (i_m[j] && rq[j][R_LIM +: ADDR_W+1] <= cbe) begin
        i_p = i_p + 3'd1;
        if (rq[j][R_EOF]) i_eof = 1'b1;
        if (rq[j][R_ER]) begin i_fail = 1'b1; i_code = rq[j][R_CODE +: 5]; end
      end
    end
  end
  /* verilator lint_on WIDTHTRUNC */
  /* verilator lint_on WIDTHEXPAND */
  always @(*) iss_v = i_v & {P{!err}};

  // ---------------- banks: A (read) / B (execute, write, emit) ----------------
  reg                tA_eof, tA_lin2, tB_eof, tB_lin2;
  wire [P-1:0]       lane_ovf;
  wire [P-1:0]       lane_live;
  wire [P*32-1:0]    lane_code;
  wire [P*ADDR_W-1:0] lane_e;
  wire [P-1:0]       lane_ev;
  wire [P-1:0]       busy_v;
  genvar gb;
  generate for (gb = 0; gb < P; gb = gb + 1) begin : bank
    (* ram_style = "block" *) reg [31:0] mh1 [0:(1<<BA)-1];
    (* ram_style = "block" *) reg [31:0] mh2 [0:(1<<BA)-1];
    reg [31:0] rd1, rd2, fw1d, fw2d;
    reg        fw1, fw2;
    reg              tA_v, tA_ev, tB_v, tB_ev;
    reg [ADDR_W-1:0] tA_e, tB_e;
    reg signed [31:0] tA_q;
    reg signed [47:0] tB_dq;           // q << G, formed in stage A
    wire signed [31:0] h1 = fw1 ? fw1d : rd1;
    wire signed [31:0] h2 = fw2 ? fw2d : rd2;
    wire signed [33:0] h1x = {{2{h1[31]}}, h1};
    wire signed [33:0] h2x = {{2{h2[31]}}, h2};
    wire signed [33:0] hold = mode_lin ? (tB_lin2 ? (h1x <<< 1) - h2x : h1x) : (mode_last ? h1x : 34'sd0);
    wire        hold_ovf = (hold[33:31] != 3'b000) && (hold[33:31] != 3'b111);
    wire signed [47:0] qxA = {{16{tA_q[31]}}, tA_q};
    wire signed [47:0] cn48 = {{14{hold[33]}}, hold} + (tB_ev ? tB_dq : 48'sd0);
    wire        cn_ovf = (cn48[47:31] != 17'd0) && (cn48[47:31] != {17{1'b1}});
    wire [31:0] cnew = cn48[31:0];
    wire        b_ovf = tB_v && (hold_ovf || cn_ovf);
    wire        we1 = clr_active || (tB_v && !b_ovf && ((mode_last && tB_ev) || mode_lin));
    wire        we2 = clr_active || (tB_v && !b_ovf && mode_lin);
    wire [BA-1:0] waddr = clr_active ? clr_cnt : tB_e[ADDR_W-1:LP];
    wire [31:0] wd1 = clr_active ? 32'd0 : cnew;
    wire [31:0] wd2 = clr_active ? 32'd0 : h1;
    assign lane_ovf[gb] = b_ovf; assign lane_live[gb] = tB_v; assign lane_code[32*gb +: 32] = cnew;
    assign lane_e[ADDR_W*gb +: ADDR_W] = tB_e; assign lane_ev[gb] = tB_ev;
    assign busy_v[gb] = tA_v || tB_v;
    always @(posedge clk) begin
      if (we1) mh1[waddr] <= wd1;
      if (we2) mh2[waddr] <= wd2;
      rd1 <= mh1[tA_e[ADDR_W-1:LP]];
      rd2 <= mh2[tA_e[ADDR_W-1:LP]];
    end
    always @(posedge clk) begin
      if (rst) begin
        tA_v <= 1'b0; tA_ev <= 1'b0; tA_e <= 0; tA_q <= 32'sd0; tB_v <= 1'b0; tB_ev <= 1'b0; tB_e <= 0; tB_dq <= 48'sd0;
        fw1 <= 1'b0; fw2 <= 1'b0; fw1d <= 32'd0; fw2d <= 32'd0;
      end else begin
        tA_v <= iss_v[gb]; tA_ev <= iss_ev[gb]; tA_e <= iss_e[ADDR_W*gb +: ADDR_W]; tA_q <= iss_q[32*gb +: 32];
        tB_v <= tA_v; tB_ev <= tA_ev; tB_e <= tA_e; tB_dq <= qxA <<< hdr_G;
        fw1 <= we1 && !clr_active && tA_v && (tA_e == tB_e);
        fw2 <= we2 && !clr_active && tA_v && (tA_e == tB_e);
        fw1d <= wd1; fw2d <= wd2;
      end
    end
  end endgenerate

  // a failing record is never issued (except the dense count check's last element); records before it are
  wire any_ovf = |lane_ovf;
  wire pipe_busy = (|busy_v) || tA_eof || tB_eof;

  task fail(input [4:0] code, input unsup);
    begin
      err <= 1'b1; unsupported <= unsup; err_code <= code; state <= S_ERR;
    end
  endtask

  always @(posedge clk) begin
    if (rst) begin
      state <= S_FIX; bidx <= 5'd0; fld_lo <= 8'd0; dacc <= {{ADDR_W{1'b0}}, 1'b1}; dbig <= 1'b0;
      cnt <= 0; eps_last <= 0; vcount <= 32'd0; hvb <= 3'd0; all_dense <= 1'b0; tok_mode <= 1'b0;
      clr_active <= 1'b0; clr_done <= 1'b0; clr_cnt <= {BA{1'b0}}; clr_last <= {BA{1'b0}};
      fr <= 32'd0; fr_last <= 1'b0; nxt <= 0; left <= 0; frem <= 0; nbig <= 1'b0; dbase <= 0; dm1 <= 0;
      cstate <= C_IDLE; ph <= 1'b0; bp <= 0; rec_n <= 5'd0; rq_cnt <= 5'd0;
      for (ii = 0; ii < K; ii = ii + 1) rec_r[ii] <= {RW{1'b0}};
      for (ii = 0; ii < RQ; ii = ii + 1) rq[ii] <= {RW{1'b0}};
      cur <= 0; cbe <= PW; ifr <= 32'd0; ilast <= 1'b0; irun <= 1'b0;
      tA_eof <= 1'b0; tA_lin2 <= 1'b0; tB_eof <= 1'b0; tB_lin2 <= 1'b0;
      out_valid <= {W{1'b0}}; out_elem <= 0; out_code <= 0; out_event <= {W{1'b0}}; out_eof <= 1'b0;
      done <= 1'b0; err <= 1'b0; unsupported <= 1'b0; err_code <= 5'd0;
      hdr_T <= 32'd0; hdr_D <= 0; hdr_G <= 5'd0; hdr_pred <= 2'd0; consumed <= 32'd0; ovf_q <= 1'b0;
    end else begin
      if (clr_active) begin
        clr_cnt <= clr_cnt + 1'b1;
        if (clr_cnt == clr_last) begin clr_active <= 1'b0; clr_done <= 1'b1; end
      end
      if (b_take) consumed <= consumed + 32'd1;

      case (state)
        S_FIX: if (b_take) begin
          bidx <= bidx + 5'd1;
          case (bidx)
            5'd0: if (b_data != 8'h53) fail(E_MAGIC, 1'b0);
            5'd1: if (b_data != 8'h34) fail(E_MAGIC, 1'b0);
            5'd2: if (b_data != 8'h44) fail(E_MAGIC, 1'b0);
            5'd3: if (b_data != 8'h49) fail(E_MAGIC, 1'b0);
            5'd4: if (b_data != 8'h01) fail(E_VERSION, 1'b0);
            5'd5: hdr_T[7:0]   <= b_data;
            5'd6: hdr_T[15:8]  <= b_data;
            5'd7: hdr_T[23:16] <= b_data;
            5'd8: hdr_T[31:24] <= b_data;
            5'd9, 5'd11, 5'd13, 5'd15: fld_lo <= b_data;
            5'd10, 5'd12, 5'd14: begin dbig <= pbig; dacc <= prod[ADDR_W:0]; end
            default: begin
              if (hdr_T == 32'd0) fail(E_T0, 1'b1);
              else if (pbig || prod == 0) fail(E_DSIZE, 1'b1);
              else begin
                hdr_D <= prod[ADDR_W:0];
                dm1 <= prod[ADDR_W:0] - 1'b1;
                eps_last <= {fld[ADDR_W:0], 3'b000} - 1'b1;
                cnt <= 0;
                clr_active <= 1'b1; clr_cnt <= {BA{1'b0}};
                clr_last <= dplus[ADDR_W-1:LP] - 1'b1;   // ceil(D / P) − 1 (D ≤ 2^ADDR_W)
                state <= S_EPS;
              end
            end
          endcase
        end
        S_EPS: if (b_take) begin
          cnt <= cnt + 1'b1;
          if (cnt == eps_last) state <= S_G;
        end
        S_G: if (b_take) begin
          if ({24'd0, b_data} > G_MAX) fail(E_G, 1'b1);
          else begin hdr_G <= b_data[4:0]; vcount <= 32'd0; hvb <= 3'd0; state <= S_TIMES; end
        end
        S_TIMES, S_STEPS: if (b_take) begin
          if (b_data[7]) begin
            if (hvb == 3'd7) fail(E_HVARINT, 1'b0);
            else hvb <= hvb + 3'd1;
          end else begin
            if (hvb == 3'd7 && b_data[6:4] != 3'd0) fail(E_HVARINT, 1'b0);
            else begin
              hvb <= 3'd0; vcount <= vcount + 32'd1;
              if (vcount + 32'd1 == hdr_T) begin
                vcount <= 32'd0;
                if (state == S_TIMES) state <= S_MFLAG;
                else begin cnt <= 0; state <= S_VERD; end
              end
            end
          end
        end
        S_MFLAG: if (b_take) state <= (b_data == 8'd1) ? S_STEPS : S_RANK;
        S_VERD: if (b_take) begin
          if (b_data > 8'd2) fail(E_VERDICT, 1'b0);
          else begin
            vcount <= vcount + 32'd1;
            if (vcount + 32'd1 == hdr_T) state <= S_RANK;
          end
        end
        S_RANK: if (b_take) begin
          if (b_data != 8'd0) fail(E_RANK, 1'b1); else state <= S_REL;
        end
        S_REL: if (b_take) begin
          if (b_data == 8'd1) fail(E_REL, 1'b1); else state <= S_PRED;
        end
        S_PRED: if (b_take) begin
          if (b_data > 8'd2) fail(E_PRED, 1'b0);
          else begin hdr_pred <= b_data[1:0]; state <= S_FW; end
        end
        S_FW: if (b_take) begin
          if (b_data != 8'd16) fail(E_FW, 1'b0); else state <= S_LAYOUT;
        end
        S_LAYOUT: if (b_take) begin
          all_dense <= (b_data == 8'd1);
          fr <= 32'd0; fr_last <= (hdr_T == 32'd1); tok_mode <= 1'b1;
          ifr <= 32'd0; ilast <= (hdr_T == 32'd1); irun <= 1'b1; cur <= 0; cbe <= PW;
          state <= S_HEAD;               // payload: classifier + issuer run
        end
        S_HEAD: if (!irun && !pipe_busy) begin done <= 1'b1; state <= S_DONE; end
        default: ;
      endcase

      // ---- stage 1: classifier result (cstate etc. are only written here and at the layout byte) ----
      if (c_run) begin
        for (cq = 0; cq <= K; cq = cq + 1) if (c_k == cq) consumed <= cons_p[cq];
        cstate <= n_cstate; ph <= n_ph; bp <= n_bp; nxt <= n_nxt; left <= n_left;
        dbase <= n_dbase; frem <= n_frem; nbig <= n_nbig;
        if (c_adv) begin fr <= fr + 32'd1; fr_last <= (fr + 32'd2 == hdr_T); end
      end
      if (state == S_LAYOUT && b_take) cstate <= (b_data == 8'd1) ? C_DENSE : C_HEAD;
      for (ii = 0; ii < K; ii = ii + 1) rec_r[ii] <= c_rec[ii];
      rec_n <= c_rn;
      // ---- record queue: one shift by the issuer pop count, then the new records ----
      for (rj = 0; rj < RQ; rj = rj + 1) begin
        if (rj < (rq_cnt - i_p)) begin
          if ((rj + i_p) < RQ) rq[rj] <= rq[rj + i_p];
        end else if (((rj - (rq_cnt - i_p)) < rec_n) && ((rj - (rq_cnt - i_p)) < K))
          rq[rj] <= rec_r[rj - (rq_cnt - i_p)];
      end
      rq_cnt <= (rq_cnt - i_p) + rec_n;
      // ---- stage 2: issuer frame bookkeeping ----
      if (i_go && !err) begin
        if (i_fail) fail(i_code, 1'b0);
        else if (i_eof) begin
          ifr <= ifr + 32'd1; ilast <= (ifr + 32'd2 == hdr_T); cur <= 0; cbe <= PW;
          if (ilast) irun <= 1'b0;
        end else begin cur <= n_cur; cbe <= (n_cur & ~PM1) + PW; end
      end

      // ---- pipeline: eof / lin2 travel with the cycle's lanes ----
      tA_eof <= i_eof && !i_fail && !err; tA_lin2 <= (ifr >= 32'd2);
      tB_eof <= tA_eof; tB_lin2 <= tA_lin2;
      out_valid <= lane_live & ~lane_ovf;
      out_elem  <= lane_e;
      out_code  <= lane_code;
      out_event <= lane_ev;
      out_eof   <= tB_eof && !any_ovf;
      // overflow: the lane's token is suppressed now; err is raised from a register one cycle later
      ovf_q <= any_ovf || ovf_q;
      if (ovf_q) fail(E_OVF, 1'b0);
    end
  end
endmodule
`default_nettype wire

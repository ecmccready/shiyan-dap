/**
 * TEST ONLY. 4D-SCP v0.1.16 — configurations and exact cycle model of the RTL temporal-only ENCODER
 * with the short emitter path (hw/scp4d/rtl/scp4d_tenc_q.v). Pure: no I/O, no env, no clocks, no
 * randomness, no Level 4 / app imports.
 *
 * scp4d_tenc_q changes only HOW the emitter computes gaps and places bytes (gaps carried in the
 * event record, explicit byte / lane selectors instead of variable shifts and `3 * lane` products);
 * it keeps every register-transfer decision of v0.1.15's scp4d_tenc_p (pipeline depth, accept rule,
 * prefetch FIFO, one or two events per cycle, append rule, queue). Its exact cycle model is
 * therefore the v0.1.15 model, re-exported here under v0.1.16 names; the check compares it with the
 * simulator for every job and (W, L) and also requires every cycle count to equal v0.1.15's.
 * The job list, host header segments and expected streams are v0.1.14's (scripts/scp-v0114-rtl-model.ts).
 */
export {
  ENCP_CONFIGS as ENCQ_CONFIGS, LOOPP_CONFIGS as LOOPQ_CONFIGS, ENCP_BQ as ENCQ_BQ, ENCP_CLOSE_EDGES as ENCQ_CLOSE_EDGES,
  ENCP_CFG_CYCLES as ENCQ_CFG_CYCLES, encpES as encqES, encpMA as encqMA, tencpCycleModel as tencqCycleModel,
} from "./scp-v0115-rtl-model";

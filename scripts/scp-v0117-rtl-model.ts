/**
 * TEST ONLY. 4D-SCP v0.1.17 — configurations and exact cycle model of the RTL temporal-only DECODER
 * with the short issue path (hw/scp4d/rtl/scp4d_tdec_r.v + scp4d_fe_r.v). Pure: no I/O, no env, no
 * clocks, no randomness, no Level 4 / app imports.
 *
 * scp4d_tdec_r changes only HOW the issue chain and the front end compute their per-cycle decisions
 * (tokens range-checked against D on queue entry, narrow gap arithmetic, pop-late queue update,
 * parallel consumed-byte sums, registered last-frame flag, dequantized step formed one stage
 * earlier); it keeps every register-transfer decision of v0.1.13's scp4d_tdec_w (queues, occupancy
 * rules, chain stop rules, banks, pipeline depth, tail). Its exact cycle model is therefore the
 * v0.1.13 model, re-exported here under v0.1.17 names; the check compares it with the simulator for
 * every vector at W = 1, 2, 4, requires every cycle count to equal v0.1.13's committed one, and
 * runs the unchanged scp4d_tdec_w in lockstep (every output, every cycle). The closed-loop
 * configurations are v0.1.16's (encoder scp4d_tenc_q unchanged).
 */
export { W_LIST as TDECR_W_LIST, TDECW_TAIL as TDECR_TAIL, payloadTokens, tdecWCycleModel as tdecRCycleModel } from "./scp-v0113-rtl-model";
export { LOOPQ_CONFIGS as LOOPR_CONFIGS } from "./scp-v0116-rtl-model";

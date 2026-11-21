# hw/scp4d — 4D-SCP RTL (TEST ONLY, unwired)

This directory holds the synthesizable Verilog for the 4D-SCP hardware path. Nothing in the Next.js app, `src/`, Level 4 or any route imports it. It contains no TS/JS, so `tsc` and `next build` never see it. Spec: `docs/design/4d-scp-architecture.md` §18 (temporal-only), §19 (relations), §20 (W-byte front end), §21 (encoder), §22 (pipelined encoder), §23 (short emitter path), §24 (short decoder issue path) and §25 (two-stage decoder).

| Milestone | What | Evidence |
|---|---|---|
| v0.1.10 | Integer-only scp4d golden model and FPGA reference vectors (software) | `scripts/check-scp-v0110.ts`, `fixtures/scp/golden-vectors-scp4d.json` |
| **v0.1.11** | `rtl/scp4d_tdec.v`: streaming S4DI v1 decoder for the temporal-only path (rank 0, relations off; zero / last (event-driven) / linear predictors) | Bit-exact against the v0.1.10 model on 7 streams in Icarus Verilog. Cycle counts are measured; synthesis numbers are estimates. `scripts/check-scp-v0111-rtl.ts`, `fixtures/scp/v0111-rtl-report.json` |
| **v0.1.12** | `rtl/scp4d_rdec.v`: event-driven decoder with declared relations (rank 0, last-value hold, relations on or off; relation program loaded through a config port) | Bit-exact against the v0.1.10 model on 8 relations streams (incl. env T64 / T256) and the 5 temporal last-value streams. Cycles measured, with an exact cycle model; synthesis numbers are estimates. `scripts/check-scp-v0112-rtl.ts`, `fixtures/scp/v0112-rtl-report.json` |
| **v0.1.13** | `rtl/scp4d_fe_w.v`: front end reading W = 1, 2 or 4 bytes per cycle (varint tokenizer); `rtl/scp4d_tdec_w.v` (temporal-only, W banks) and `rtl/scp4d_rdec_w.v` (relations, `scp4d_rdec` datapath unchanged) built on it | Bit-exact at W = 1, 2, 4 on every in-scope vector of both paths, also with random input gaps. Cycles measured and equal to an exact cycle model; synthesis numbers are estimates. `scripts/check-scp-v0113-rtl.ts`, `fixtures/scp/v0113-rtl-report.json` |
| **v0.1.14** | `rtl/scp4d_tenc_w.v`: encoder for the S4DI v1 temporal-only path (rank 0, relations off; zero / last / linear). It reads L = 1/2/4/8 integer codes per cycle and writes W = 2 bytes per cycle (W = 1 baseline), with a fixed host config. `tb/scp4d_loop_tb.v`: encoder → `scp4d_tdec_w` (W = 2) | Byte-exact with the v0.1.10 model on 18 jobs × 4 configs, also with random gaps and backpressure. The loop is bit-exact and within the deadband. 9 negatives return the right error code. Cycles are measured and equal to an exact cycle model; synthesis numbers are estimates. `scripts/check-scp-v0114-rtl.ts`, `fixtures/scp/v0114-rtl-report.json` |
| **v0.1.15** | `rtl/scp4d_tenc_p.v`: pipelined encoder variant (registered state read, split S1 / S2 arithmetic, W = 1/2/4 bytes out, two sparse events per cycle at W = 4, 32-byte queue). `tb/scp4d_loop_p_tb.v`: encoder → `scp4d_tdec_w` at the same W (2 or 4). v0.1.14 files unchanged | Byte-exact with the v0.1.10 model on 18 jobs × 6 configs (the 4 v0.1.14 configs + W4L4, W4L8), also with random gaps and backpressure. The loop is bit-exact at 5 configs. 9 negatives return the right error code. Cycles are measured and equal to an exact cycle model; synthesis numbers are estimates. `scripts/check-scp-v0115-rtl.ts`, `fixtures/scp/v0115-rtl-report.json` |
| **v0.1.16** | `rtl/scp4d_tenc_q.v`: `tenc_p` with a short emitter path (each record carries its first-event gap and event count; count-driven FIFO pop; explicit byte / lane selectors, no variable shifts). Cycle-for-cycle identical to v0.1.15. `tb/scp4d_tenc_q_tb.v`, `tb/scp4d_loop_q_tb.v`. v0.1.14 / v0.1.15 files unchanged | Byte-exact with the v0.1.10 model on 18 jobs × 6 configs, also with random gaps and backpressure. The loop is bit-exact. 9 negatives return the right error code. Cycles are measured and equal to v0.1.15's counts (exact model); synthesis numbers are estimates (ECP5 router2, with same-flow reference rows). `scripts/check-scp-v0116-rtl.ts`, `fixtures/scp/v0116-rtl-report.json` |
| **v0.1.17** | `rtl/scp4d_tdec_r.v` + `rtl/scp4d_fe_r.v`: `tdec_w` with a short issue path (tokens range-checked against D on entry, narrow signed gap compares, pop-late token queue, consumed / last-frame off the chain tail). Cycle-for-cycle identical to v0.1.13. `tb/scp4d_tdec_r_tb.v` (lockstep against the unchanged `tdec_w`), `tb/scp4d_loop_r_tb.v` (`tenc_q` → `tdec_r`). v0.1.10–v0.1.16 files unchanged | Bit-exact with the v0.1.10 model on 7 vectors at W = 1, 2, 4, also with random gaps; 14 out-of-scope / negative streams return the right code; the lockstep trace equals `tdec_w` on every cycle of every run. The loop is bit-exact on 18 jobs × 5 configs. Cycles are measured and equal to v0.1.13 / v0.1.16 counts; synthesis numbers are estimates (ECP5 router2, same-flow reference rows). `scripts/check-scp-v0117-rtl.ts`, `fixtures/scp/v0117-rtl-report.json` |
| **v0.1.18** | `rtl/scp4d_tdec_s.v`: `tdec_r` split into a token classifier and a bank issuer (new cycle model). Front end is the unchanged `scp4d_fe_r`. `tb/scp4d_tdec_s_tb.v`, `tb/scp4d_loop_s_tb.v` (`tenc_q` → `tdec_s`). v0.1.10–v0.1.17 files unchanged | Bit-exact with the v0.1.10 model at W = 1, 2, 4, and element-for-element equal to `tdec_w` and `tdec_r`. Cycles measured (env T64 temporal-last: W2 28,443, W4 15,197; loop W4L8 19,048). One-seed ECP5 post-route: W2 44.48 MHz (7,955 LUT), W4 37.56 MHz (23,785 LUT). The W4 loop did not finish place-and-route within 2400 s, so that Fmax is not reported. `scripts/check-scp-v0118-rtl.ts`, `fixtures/scp/v0118-rtl-report.json`, spec §25 |

## Layout

- `rtl/scp4d_tdec.v`: the decoder. It is Verilog-2005 with no initial blocks, system tasks, division or floats. The parameter ADDR_W = 11 sets the maximum D at 2048.
- `tb/scp4d_tb.v`: the self-checking testbench, for simulation only. It reads `.hex` inputs generated from the JSON vectors by `scripts/scp-v0111-rtl-vectors.ts`, compares every element of every frame and counts cycles.
- `synth/synth.ys`: the Yosys script, with generic, iCE40 and Xilinx 7-series passes. nextpnr-ice40 runs place-and-route on an HX8K.
- `rtl/scp4d_rdec.v`, `tb/scp4d_rdec_tb.v`, `synth/synth_rdec.ys`: the v0.1.12 relations decoder, its testbench (which also loads the relation program generated by `scripts/scp-v0112-rtl-vectors.ts`) and its Yosys script. `check-scp-v0112-rtl.ts --synth` also places both decoders on an ECP5 LFE5U-45F and on an iCE40-HX8K at ADDR_W = 9 for a like-for-like comparison.
- `rtl/scp4d_fe_w.v`, `rtl/scp4d_tdec_w.v`, `rtl/scp4d_rdec_w.v`, `tb/scp4d_tdec_w_tb.v`, `tb/scp4d_rdec_w_tb.v` (parameter W): the v0.1.13 wide-input decoders and testbenches. `synth/scp4d_pnr_wrap.v` is a thin place-and-route wrapper (registered, XOR-folded outputs; serial program load) used for every configuration in `check-scp-v0113-rtl.ts --synth`, because W = 4 has more ports than the packages have pins.
- `rtl/scp4d_tenc_w.v`, `tb/scp4d_tenc_w_tb.v`, `tb/scp4d_loop_tb.v`, `synth/scp4d_tenc_wrap.v` (wrappers `wrap_tenc_w`, `wrap_loop`): the v0.1.14 encoder, its testbench, the closed loop with `scp4d_tdec_w`, and the place-and-route wrappers.
- `rtl/scp4d_tenc_p.v`, `tb/scp4d_tenc_p_tb.v`, `tb/scp4d_loop_p_tb.v`, `synth/scp4d_tenc_p_wrap.v` (wrappers `wrap_tenc_p`, `wrap_loop_p`): the v0.1.15 pipelined encoder, its testbench, the closed loop with `scp4d_tdec_w` at the same W, and the place-and-route wrappers.
- `rtl/scp4d_tenc_q.v`, `tb/scp4d_tenc_q_tb.v`, `tb/scp4d_loop_q_tb.v`, `synth/scp4d_tenc_q_wrap.v` (wrappers `wrap_tenc_q`, `wrap_loop_q`): the v0.1.16 short-emitter-path encoder and its testbench, loop and wrappers.
- `rtl/scp4d_tdec_r.v`, `rtl/scp4d_fe_r.v`, `tb/scp4d_tdec_r_tb.v`, `tb/scp4d_loop_r_tb.v`, `synth/scp4d_tdec_r_wrap.v` (wrappers `wrap_tdec_r`, `wrap_loop_r`): the v0.1.17 short-issue-path decoder, its front end, lockstep testbench, loop and wrappers.
- `rtl/scp4d_tdec_s.v`, `tb/scp4d_tdec_s_tb.v`, `tb/scp4d_loop_s_tb.v`, `synth/scp4d_tdec_s_wrap.v` (wrappers `wrap_tdec_s`, `wrap_loop_s`): the v0.1.18 two-stage decoder, its testbench, loop and wrappers. The front end is `scp4d_fe_r`.

## Scope

`scp4d_tdec` (v0.1.11) rejects streams that use relations or a low-rank base at the header with `unsupported = 1` (code 9 for relations, 8 for rank). They are never mis-decoded.

`scp4d_rdec` (v0.1.12) decodes relations streams with the last-value hold. It rejects rank > 0 (code 8) and the zero or linear predictor (code 19, use `scp4d_tdec` for those) with `unsupported = 1`. At full parameters (D ≤ 2048) it does not fit the iCE40-HX8K's block RAM (69 of 32 needed). It places on an ECP5 LFE5U-45F at about 54 MHz (estimate).

**Measured on env T64:** relations give 1.84× fewer bytes for 1.84× the cycles (0.798 vs 0.434 cycles per element-frame). Relations are worth it only when stream bytes are expensive: below ~28.7 MB/s of link bandwidth, or above ~102 pJ/B. Both break-evens are labelled estimates; see §19.5.

**v0.1.13, wider input (env T64):** temporal-only goes from 56,865 cycles at W = 1 to 28,444 at W = 2 and 15,494 at W = 4. The W = 4 issue chain roughly halves the ECP5 fmax estimate (22 vs 41 MHz), so W = 2 is the wall-clock sweet spot (~190 M element-frames/s, estimate). Relations gain only 1.16× (104,226 → 89,538 cycles), because 81% of their cycles are fan-out and flush. W = 4 does not fit the iCE40-HX8K at ADDR_W = 9. See §20.

**v0.1.14, encoder and loop (env T64, last):**
- Encoder cycles: 131,796 at W1L1, 65,911 at W2L2, 36,656 at W2L4 and 29,204 at W2L8. The W = 2 decoder takes 28,444.
- Loop end to end at L = 8: 29,986 cycles.
- What limits it: the input at L ≤ 4 (every code is read); the 2-byte output port plus one START cycle per frame at L = 8.
- ECP5-45F estimate for W2L8: 12,360 LUT, 4,786 FF, 24 DP16KD, 1 MULT18, 35.86 MHz, ~161 M values/s.
- Per cycle, the encoder keeps up only at L = 8. In wall clock it does not (0.85× the decoder).
- iCE40-HX8K fits only W1L1 and W2L2.

See §21.

**v0.1.15, pipelined encoder (env T64, last):**
- Encoder cycles: 29,237 at W2L8, 33,032 at W4L4 and 18,527 at W4L8. The W = 2 decoder takes 28,444.
- ECP5-45F estimate for W4L8: 21,169 LUT, 8,221 FF, 25 DP16KD, 6 MULT18, 28.98 MHz → ~205 M values/s, 1.08× the W = 2 decoder (189.7 M) and 1.10× the W = 4 decoder (186.1 M).
- **It keeps up in wall clock at W4L8 only.** The margin is thin and rests on one-seed estimates. It comes from fewer cycles, not a faster clock. W2L8 reaches 0.87× (36.83 MHz, up from 35.86).
- The ECP5 critical path at W4L8 is now the two-event sparse emitter and its byte packing, not the state read.
- Loop W4L8 → `tdec_w` W4: 19,223 cycles; the pair runs at the W = 4 decoder's clock (21.24 MHz, ~145 M values/s).
- iCE40-HX8K fits only W1L1 (43.81 MHz).

See §22.

**v0.1.16, short emitter path (env T64, last):**
- Cycles are identical to v0.1.15 (W4L8 18,527; W2L8 29,237); only the clock changes.
- ECP5-45F estimate for W4L8 (nextpnr router2): 19,333 LUT, 8,322 FF, 25 DP16KD, 1 MULT18 at 39.73 MHz → ~281 M values/s. That is 1.48× the W = 2 decoder (189.7 M) and 1.51× the W = 4 decoder (186.1 M); v0.1.15 was 1.08× / 1.10×.
- With every design re-placed under the same flow (router2), it is 1.99× / 1.75× the decoders, and the clock is 1.62× v0.1.15 `tenc_p` (24.59 MHz in the same run).
- **It keeps up with a real margin at W4L8.** W2L8 keeps up only just (45.43 MHz, 1.07×), and W4L4 is at parity.
- router1 did not converge on `tenc_q` W4L8, hence router2. On these designs router2 gives lower clocks than router1, so the comparison against the committed decoder figures is conservative.
- Loop W4L8 → `tdec_w` W4: 18.31 MHz (router2), ~125 M values/s. The W = 4 decoder clock is now the end-to-end limit.
- iCE40-HX8K fits only W1L1 (41.33 MHz).

See §23.

**v0.1.17, short decoder issue path (env T64, last):**
- Cycles are identical to v0.1.13 (W2 28,444; W4 15,494) and the loop to v0.1.16 (W4L8 19,223); only the clock changes.
- ECP5-45F estimates (router2, one seed, all rows in the same run): `tdec_r` W2 6,240 LUT, 1,783 FF at 44.32 MHz (ref `tdec_w` 34.66, 1.28×) → ~204 M values/s; `tdec_r` W4 17,763 LUT, 3,097 FF at 23.07 MHz (ref 20.33, 1.13×) → ~195 M values/s.
- The same unchanged designs differ by up to ~13% between the v0.1.16 run and this one, so the W = 4 gain is near the one-seed spread.
- Loop W4L8 → `tdec_r` W4: 38,103 LUT (87%), 22.29 MHz (ref loop 19.45 in the same run; 18.31 committed in v0.1.16) → ~152 M values/s. **The W = 4 decoder still limits the loop** (0.70× the encoder's ~280 M values/s).
- iCE40-HX8K fits `tdec_r` W2 (6,660 LC, 38.92 MHz); W4 does not fit.
- The critical path is now the four-step serial issue chain itself; the proposed v0.1.18 splits it into a token classifier and a bank issuer (new cycle model).

See §24.

**v0.1.18, two-stage decoder (env T64, temporal-last):**

- Decoder cycles: 56,864 at W = 1, 28,443 at W = 2, 15,197 at W = 4. The v0.1.17 decoder on the same stream is 56,865 / 28,444 / 15,494.
- Loop `tenc_q` → `tdec_s`: 30,015 cycles at W2L8 and 19,048 at W4L8 (v0.1.17 loop: 30,016 and 19,223).
- ECP5-45F, this run, router2, seed 1: `tdec_s` W2 7,955 LUT / 2,279 FF at 44.48 MHz (204,974,249 values/s); W4 23,785 LUT / 4,017 FF at 37.56 MHz (323,949,748 values/s, 1.8411× same-run `tdec_r`). The W2 loop placed at 40.28 MHz. The W4 loop exceeded the script's 2400 s place-and-route bound and has no Fmax.
- iCE40-HX8K: `tdec_s` W2 and W4 do not fit. `tdec_r` W2 does (39.46 MHz).
- Energy: not measured.

See §25.

## Run (Linux / WSL)

```bash
sudo apt install iverilog            # required for simulation
# optional: sudo apt install yosys verilator nextpnr-ice40   (or the YosysHQ oss-cad-suite release)
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0111-rtl.ts --require-sim
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0111-rtl.ts --synth    # re-run synthesis (estimates)
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0112-rtl.ts --require-sim
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0112-rtl.ts --synth    # relations decoder; also needs nextpnr-ecp5
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0113-rtl.ts --require-sim
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0113-rtl.ts --synth --write   # W = 1/2/4 synthesis (estimates)
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0114-rtl.ts --require-sim
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0114-rtl.ts --write --synth   # encoder + loop synthesis (estimates, ~25 min)
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0115-rtl.ts --require-sim
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0115-rtl.ts --write --synth   # pipelined encoder + loop synthesis (estimates, ~40 min)
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0116-rtl.ts --require-sim
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0116-rtl.ts --write --synth   # short-emitter encoder + loop + same-flow refs (estimates, ~60 min)
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0117-rtl.ts --require-sim
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0117-rtl.ts --write --synth   # short-issue-path decoder + loop + same-flow refs (estimates, ~55 min)
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0118-rtl.ts --require-sim
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0118-rtl.ts --write --synth   # two-stage decoder + loops + same-flow refs (this machine: 4275 s)
```

Without a simulator, each check prints `SKIP sim` and runs the same counted checks against the committed report (33 for v0.1.11, 27 for v0.1.12, 27 for v0.1.13, 19 for v0.1.14, 20 for v0.1.15, 22 for v0.1.16, 22 for v0.1.17, 24 for v0.1.18). The closed-form cycle model matches the measured counts exactly. The script also looks for tools in `/opt/eda/oss-cad-suite/bin`.

## Honest labels

- **Cycles:** measured by simulating this RTL. They are cycle-accurate for this design.
- **Synthesis and place-and-route figures:** tool estimates for one device. No board was programmed.
- **Energy:** not measured.
- **Fixtures:** synthetic or hand-written test data only.

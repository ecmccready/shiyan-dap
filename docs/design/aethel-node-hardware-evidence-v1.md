# Aethel Node Hardware Evidence Package v1

This package is the hardware track's evidence. Numbers appear only after `scripts/bench-ecp5-v0119.ts` writes them into `fixtures/scp/v0119-industry-benchmark.json`. Power needs a programmed board and is not measured.

## Baseline

Frozen reference designs are the RTL under `hw/scp4d/rtl/` from v0.1.11 through v0.1.18. Functional requirements are bit-exact decode or encode against the v0.1.10 integer model, checked by `scripts/check-scp-v0111-rtl.ts` through `scripts/check-scp-v0118-rtl.ts`. The benchmark does not rewrite those designs.

## Experiment

Identical toolchain and constraints for every design: Yosys `synth_ecp5`, nextpnr-ecp5 on LFE5U-45F (CABGA381), `--router router2`, `--freq 12`, `--timing-allow-fail`, seeds 1–5, bound 7200 s. The manifest records the tool version strings, the exact command, and the wall clock of each invocation.

## Verification

The benchmark's bit-exact phase re-runs the RTL checks with `--require-sim` against the committed golden vectors. Pass or fail is stored on the manifest. It is not assumed.

## Comparison

Throughput, LUT, FF, BRAM, clock, and the Pareto set are computed by `scripts/ecp5-v0119-score.ts` from finished seeds only. The generated table is `docs/design/v0119-industry-benchmark.md`.

This run, committed on `cursor/v0119-ecp5-benchmark-cbc7`:

- Bit-exact: all eight RTL checks passed under `--require-sim`.
- 20 designs have a five-seed median on the 45F. `loop-s-w4l8` does not. Seeds 1–4 routed. Seed 5 is `not_completed` at 7200 s, exit 124, Fmax null. There is no five-seed median for that design.
- `loop-s-w4l8` does not fit the 12F or the 25F. A seed-1 route on the 85F did finish. The smallest part that routed is the 45F.
- Pareto set (median Fmax, median throughput, values/s per LUT): `rdec`, `tdec`, `tdec-r-w2`, `tdec-s-w2`, `tdec-s-w4`, `tenc-q-w4l8`.
- The advisor reads those medians. The fastest closed loop that has a five-seed median is `loop-s-w2l8`. On that loop the encoder `tenc-q-w2l8` is the slower constituent. The highest-throughput measured encoder is `tenc-q-w4l8`. The clocks and values/s are the manifest fields, not restated here, so this paragraph cannot drift from the table.

## Reproduction

`docs/design/v0119-reproduce.md`. Source, constraint and report SHA-256 hashes are in the manifest.

## Commercial demonstration

`src/scp/evidence/benchmark-advisor.ts` reads the measured rows (the benchmark calls it when it refreshes the manifest). It names the closed loop with a measured throughput, the slower of that loop's encoder and decoder by median Fmax, and the next already-measured design of that kind. It does not invent an Fmax. An unbuilt change is returned with `measured: false`. Later runs reuse a seed only when `reuseDecision` sees the same source hash, tool id, part, seed and command hash.

## Global misdiagnosis

Not coupled. The synthetic Medicare fixture used by the software 4D-SCP bench stays in `scripts/scp-v019-env-fixture.ts`. No patient data is read.

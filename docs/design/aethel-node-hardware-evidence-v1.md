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

## Reproduction

`docs/design/v0119-reproduce.md`. Source, constraint and report SHA-256 hashes are in the manifest.

## Commercial demonstration

`src/scp/evidence/benchmark-advisor.ts` reads the measured rows (the benchmark calls it when it refreshes the manifest). It names the closed loop with a measured throughput, the slower of that loop's encoder and decoder by median Fmax, and the next already-measured design of that kind. It does not invent an Fmax. An unbuilt change is returned with `measured: false`. Later runs reuse a seed only when `reuseDecision` sees the same source hash, tool id, part, seed and command hash.

## Global misdiagnosis

Not coupled. The synthetic Medicare fixture used by the software 4D-SCP bench stays in `scripts/scp-v019-env-fixture.ts`. No patient data is read.

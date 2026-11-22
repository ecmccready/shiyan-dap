# Reproduce the v0.1.19 numbers

These commands are the ones the benchmark runs. Figures in the manifest are whatever this command wrote. Do not copy a number in by hand.

```bash
export PATH="/opt/eda/oss-cad-suite/bin:$PATH"
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/bench-ecp5-v0119.ts --bit-exact
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/bench-ecp5-v0119.ts --only=<design-id> --seed=<1-5>
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/bench-ecp5-v0119.ts --only=<design-id> --fit
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/bench-ecp5-v0119.ts --write-docs
```

Design ids in that harness: `tdec`, `tdec-w-w2`, `tdec-w-w4`, `tdec-r-w2`, `tdec-r-w4`, `tdec-s-w2`, `tdec-s-w4`, `rdec`, `rdec-w-w2`, `rdec-w-w4`, `tenc-w-w2l8`, `tenc-p-w2l8`, `tenc-p-w4l8`, `tenc-q-w2l8`, `tenc-q-w4l8`, `loop-w-w2l8`, `loop-p-w4l8`, `loop-q-w4l8`, `loop-r-w4l8`, `loop-s-w2l8`, `loop-s-w4l8`, `ede-temporal`, `ede-relations`, `fsd`, `loop-ede-w4l8`, `hybrid`. Example: `--only=ede-temporal --seed=1`, then `--only=ede-temporal --fit`. A record already present under `fixtures/scp/v0119-pnr/<id>/` is reused and is not re-run. `loop-ede-w4l8` instantiates `scp4d_tenc_q_w4l8_bram` and `scp4d_tdec_s_w4_bram`. The v0.1.19 modules `scp4d_tenc_q` and `scp4d_tdec_s` are the other design ids. `hybrid` is `wrap_hybrid` (`scp4d_ede` + `scp4d_fsd` + the frame-boundary selector) at ADDR_W 8.

Place-and-route bound: 7200 s per invocation (`timeout --foreground 7200`). Exit 124 is recorded as not completed within 7200 s. No Fmax is filled in for that seed.

45F route command (seed N):

```text
nextpnr-ecp5 --45k --package CABGA381 --json n.json --lpf-allow-unconstrained --freq 12 --router router2 --seed N --timing-allow-fail --report <report.json>
```

Fit command, seed 1, part in {--12k, --25k, --85k}, package CABGA381. `--pack-only` first. The route command above is run only when packing exits 0.

Tools recorded in the manifest: Yosys Yosys 0.71+50 (git sha1 583f380c6, Release, Clang /usr/bin/clang++ 21.1.8); "nextpnr-ecp5" -- Next Generation Place and Route (Version nextpnr-0.11.1-103-ge811ba48); Project Trellis ecppack Version 1.4-88-g2d12005; OSS CAD Suite 20261118.

Power is not measured. It needs a programmed board.

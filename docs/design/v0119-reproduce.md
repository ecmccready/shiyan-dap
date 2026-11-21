# Reproduce the v0.1.19 numbers

These commands are the ones the benchmark runs. Figures in the manifest are whatever this command wrote. Do not copy a number in by hand.

```bash
export PATH="/opt/eda/oss-cad-suite/bin:$PATH"
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/bench-ecp5-v0119.ts --bit-exact
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/bench-ecp5-v0119.ts --only=<design-id> --seed=<1-5>
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/bench-ecp5-v0119.ts --only=<design-id> --fit
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/bench-ecp5-v0119.ts --write-docs
```

Place-and-route bound: 7200 s per invocation (`timeout --foreground 7200`). Exit 124 is recorded as not completed within 7200 s. No Fmax is filled in for that seed.

45F route command (seed N):

```text
nextpnr-ecp5 --45k --package CABGA381 --json n.json --lpf-allow-unconstrained --freq 12 --router router2 --seed N --timing-allow-fail --report <report.json>
```

Fit command, seed 1, part in {--12k, --25k, --85k}, package CABGA381. `--pack-only` first. The route command above is run only when packing exits 0.

Tools recorded in the manifest: Yosys Yosys 0.33 (git sha1 2584903a060); "nextpnr-ecp5" -- Next Generation Place and Route (Version 0.6-3build5); ; OSS CAD Suite .

Power is not measured. It needs a programmed board.

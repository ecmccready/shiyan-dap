# Virtual chip

The 4D-SCP hybrid is the first virtual chip in this repository. A proposal names a new architecture. Shiyan DAP measures it on a pinned toolchain. The evidence gate accepts or rejects it. The same gate is what a later physical board would pass through. The virtual path does not replace that board.

This document is a design record of the loop that already ran for v0.1.25 through v0.1.29. It is not a claim that the loop beats any other company's design flow. No such comparison has been measured.

## The stack

1. **Proposal.** A named change, with the cost it is supposed to remove. For v0.1.29 the proposal was `scp4d_hybrid_coh`: keep both engines' memories coherent so a switch does not replay the array.
2. **Pre-registration.** `fixtures/scp/v01xx-prereg.json` is committed before the held-out run. The selector procedure has a sha256. Training seeds and held-out seeds are different. Held-out seeds 9 and 13 are not regenerated to chase a result.
3. **Freeze.** `fixtures/scp/v01xx-freeze.json` records the percent, hold, or start chosen from training only, and the procedure hash. It is committed before held-out.
4. **Measurement.** Icarus Verilog for decision records. Place-and-route on the pinned tools: OSS CAD Suite 20261118, Yosys 0.71+50 `583f380c6`, nextpnr-ecp5 0.11.1-103-ge811ba48, router2, seeds 1–5, `--45k CABGA381`, `--freq 12`, `--timing-allow-fail`, 7200 s, serial. Wall time is held-out host cycles divided by that design's own five-seed 45F median Fmax.
5. **Evidence gate.** The pre-registered rule is applied to the measured cycles and the measured median. A miss is STOP or FAIL. The percent is not edited after held-out.
6. **Ledger.** `fixtures/scp/optimization-ledger.jsonl` stores the verdict. `fixtures/virtual-chip/ledger.json` is the machine-readable extract for this loop. `scripts/check-virtual-chip.ts` rebuilds each verdict from the committed fixtures and fails if the stored verdict does not follow.

## Two execution paths

Both paths use the same proposal, the same pre-registration, and the same gate.

| Path | What runs | What is measured | What is not measured |
| --- | --- | --- | --- |
| Virtual chip | Icarus simulation and nextpnr timing on the pinned toolchain | Decision-set equality, host cycles, Fmax, `TRELLIS_COMB`, `DP16KD`, FF, critical path, route wall-clock | Power, board I/O, silicon delay |
| Physical board | A future Lattice ECP5 board run of the same netlist | Power and wall time on the board | Not started. Power stays **needs real board** |

## One completed cycle: v0.1.29

The profile on training seeds 17 and 19 (`fixtures/scp/v0129-profile.json`) showed that steady full-scan frames already matched standalone N=4 engine cycles. The extra host cycles were the fsd-to-K1 replay and the K1-to-fsd catch-up scan. At ADDR_W 8 on the high-churn shape, four frames that begin on K1 after a switch accounted for 11674 of 12472 extra host cycles.

Proposal: `scp4d_hybrid_coh`. Pre-registration `c17b3064`, procedure hash `a2b95b5bff379a55ef200a2a1097ba26cb00c44a30fad5bee87ba931a6feafb7`. Freeze `6076edfb`: percent 8, hold 1, start K1, the legal training minimum (sum 266848). Measurement `e1291744`. PR #23 merged the freeze. PR #24 holds the measurement and was open when this page was written.

Result, recomputed by the check from `fixtures/scp/v0129-heldout.json` and the manifest median 36.48170471191406 MHz:

- Original seed 9 wall time is under pipelined K1 and under pure N=4 at ADDR_W 8, 10 and 12.
- High-churn seed 13 is under pipelined K1 and above pure N=4 at all three widths.
- Both workloads are bit-exact and use both engines.
- The pre-registered rule requires all six cells. The verdict is **STOP**. `accepted` is false.

The opening high-churn frame still ran on K1 because the frozen start was K1. The training grid opens on a low band, so that start won there. The selector was not changed after held-out.

## What the record can support, in principle

These are descriptions of this repository's evidence. They are not a measured comparison against another team's flow.

**Finds costs a manual pass had not isolated.** The v0.1.29 profile located the switch replay. The v0.1.27 measurement showed the 4-wide full scan beating pipelined K1 on wall time on both the original held-out set (359.982748 / 1427.300522 / 2869.360567 µs) and the high-churn set (614.951347 / 2437.939427 / 4876.655672 µs), while the hybrid of that milestone did not. Both facts are in the committed fixtures. Nothing here shows that another company's flow would have missed them.

**Reproducible from the tree.** The toolchain, seeds, and flags are in each pre-registration. Source hashes and nextpnr report hashes are in `fixtures/scp/v0119-industry-benchmark.json`. `scripts/check-scp-v0121-hashes.ts` checks them. `scripts/check-virtual-chip.ts` recomputes the ledger verdicts. A third party with the pinned OSS CAD Suite can rerun one seed with:

```text
export PATH="/opt/eda/oss-cad-suite/bin:$PATH"
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/bench-ecp5-v0119.ts --only=loop-hcoh-w4l8 --seed=1
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-virtual-chip.ts
```

A record already under `fixtures/scp/v0119-pnr/<id>/` is reused and is not re-routed. Deleting that directory and running the command again is the full rerun. `scripts/check-scp-all.ts` reruns the Icarus checks.

**Time that was actually recorded.** Route wall-clock seconds are the `wall_clock_s` fields in `fixtures/scp/v0119-pnr/`. For `loop-hcoh-w4l8` the five 45F routes are 160.378, 190.558, 166.025, 168.974 and 148.243 s. The 85F seed-1 route is 145.756 s. The 12F and 25F seed-1 routes do not fit (41.29 s and 41.4246 s). The v0.1.29 `check-scp-all` log in the measurement report runs from 17:32:39 to 18:58:09 UTC. Those are the numbers this repo has. No one has measured how long a conventional team would take to reach the same netlist, so a cost comparison is not available.

## Limits and not yet shown

- Power has not been measured. It stays **needs real board**.
- No physical board path has been run.
- No baseline of another team's calendar time or dollar cost has been recorded. The "faster than a conventional flow" claim is not supported.
- v0.1.29 did not beat both pure engines on both held-out workloads. The gate rejected it.
- Fmax medians are place-and-route estimates on the pinned tools, not silicon.
- The virtual-chip ledger covers the milestones listed in `fixtures/virtual-chip/ledger.json` only.

## Second cycle: v0.1.30

Frame 0 is buffered until its own eof and replayed into the engine that count selects. Pre-registration `54d533e6`, hash `202d95ef8fbff7206a4721968f9dfc5d3b755e1674e6ea8422bc48e469674581`. Freeze `1c540468`: percent 8, hold 1. Training seed 31 opens low and stays on K1 for frame 0. Training seed 35 opens high and selects full scan for frame 0. Neither seed is seed 13.

The replay of frame 0 is extra host cycles and is inside the measured total. Median Fmax is 39.474205017089844 MHz. All six held-out cells are strictly under pipelined K1 and pure N=4. The gate's verdict is **PASS**. The ledger entry is in this result, next to the fixtures the check reads. PR #26 recorded v0.1.25 through v0.1.29 and is merged.

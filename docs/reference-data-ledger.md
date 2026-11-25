# Reference Data Ledger

The ledger records 4D-SCP evidence. The owner wrote 4D-SPC. This repository's established name is **4D-SCP**. Records, the front door, and this document use 4D-SCP.

Power is **needs real board**. No PHI. No clinical claims. Nothing here is a commercial chip.

## Fields

Each record in `fixtures/reference-ledger/records.json` has:

| Field | What it holds |
| --- | --- |
| Workload identity | Which design and configuration the record is about |
| Input conditions | Seeds, fractions, toolchain pins, and what was not used to fit |
| Baseline | The earlier measured point the experiment is compared with |
| Experiment | The change that was frozen |
| Build provenance | Pre-registration, procedure hash, and pull request |
| Implementation | Place-and-route or simulation figures copied from a fixture |
| Hardware target | Device, package, and the power statement |
| Validation | Bit-exact result, or null when that check does not apply |
| Evidence | One or more labels: `simulated`, `routed`, `physically_measured` |
| Outcome | `PASS`, `STOP`, or `RECORDED`, plus whether it is a kept negative result |

The JSON Schema is `fixtures/reference-ledger/schema.json`. The TypeScript type is `src/lib/reference-ledger/types.ts`.

A STOP stays in the ledger. A result is not relabeled as physically measured because a route succeeded.

## Seeded records

| Id | Verdict | Labels | Source of the numbers |
| --- | --- | --- | --- |
| v0.1.31 | RECORDED | simulated, routed | `fixtures/scp/versa-bitstream/summary.json`, `fixtures/scp/v0131-prereg.json` |
| v0.1.28 | STOP | simulated, routed | `fixtures/virtual-chip/ledger.json`, `fixtures/scp/v0128-heldout.json`, `fixtures/scp/v0119-industry-benchmark.json` design `loop-hnfix-w4l8` |
| v0.1.29 | STOP | simulated, routed | same ledger, `fixtures/scp/v0129-heldout.json`, design `loop-hcoh-w4l8` |
| v0.1.30 | PASS | simulated, routed | same ledger, `fixtures/scp/v0130-heldout.json`, design `loop-hff-w4l8` |

v0.1.31 is the reduced Versa image (ADDR_W 8, cfg_D 256), not the 35,438 TRELLIS_COMB loop. Median Fmax is 53.61930465698242 MHz, 5/5 seeds, 2,447 TRELLIS_COMB, three packaged files (`.bit`, `.spi.bit`, `.svf`). It has not been loaded on a board.

## Boundaries

- **Core boundary.** Semiconductor computation and verification.
- **Computational boundary.** 4D-SCP.
- **Domain boundary.** Verticals do not redefine the core. Global Misdiagnosis, ACA/Medicare, and other domains keep their own inputs, rules, agents, measurements, and evidence format.
- **Evidence boundary.** Results stay separately labeled until verified. Simulated, routed, and physically measured are different labels.

## Check

```text
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-reference-ledger.ts
```

The check is also in `scripts/check-scp-all.ts`. It rejects a record whose figures differ from the cited fixture.

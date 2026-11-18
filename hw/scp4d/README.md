# hw/scp4d — 4D-SCP RTL (TEST ONLY, unwired)

This directory holds the synthesizable Verilog for the 4D-SCP hardware path. Nothing in the Next.js app, `src/`, Level 4 or any route imports it. It contains no TS/JS, so `tsc` and `next build` never see it. Spec: `docs/design/4d-scp-architecture.md` §18.

| Milestone | What | Evidence |
|---|---|---|
| v0.1.10 | Integer-only scp4d golden model and FPGA reference vectors (software) | `scripts/check-scp-v0110.ts`, `fixtures/scp/golden-vectors-scp4d.json` |
| **v0.1.11** | `rtl/scp4d_tdec.v`: streaming S4DI v1 decoder for the temporal-only path (rank 0, relations off; zero / last (event-driven) / linear predictors) | Bit-exact against the v0.1.10 model on 7 streams in Icarus Verilog. Cycle counts are measured; synthesis numbers are estimates. `scripts/check-scp-v0111-rtl.ts`, `fixtures/scp/v0111-rtl-report.json` |

## Layout

- `rtl/scp4d_tdec.v`: the decoder. It is Verilog-2005 with no initial blocks, system tasks, division or floats. The parameter ADDR_W = 11 sets the maximum D at 2048.
- `tb/scp4d_tb.v`: the self-checking testbench, for simulation only. It reads `.hex` inputs generated from the JSON vectors by `scripts/scp-v0111-rtl-vectors.ts`, compares every element of every frame and counts cycles.
- `synth/synth.ys`: the Yosys script, with generic, iCE40 and Xilinx 7-series passes. nextpnr-ice40 runs place-and-route on an HX8K.

## Scope

Streams that use relations or a low-rank base are rejected at the header with `unsupported = 1` (code 9 for relations, 8 for rank). They are never mis-decoded. Relations in RTL are the next step.

## Run (Linux / WSL)

```bash
sudo apt install iverilog            # required for simulation
# optional: sudo apt install yosys verilator nextpnr-ice40   (or the YosysHQ oss-cad-suite release)
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0111-rtl.ts --require-sim
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0111-rtl.ts --synth    # re-run synthesis (estimates)
```

Without a simulator, the check prints `SKIP sim` and runs the same 33 counted checks against the committed report. The closed-form cycle model matches the measured counts exactly. The script also looks for tools in `/opt/eda/oss-cad-suite/bin`.

## Honest labels

- **Cycles:** measured by simulating this RTL. They are cycle-accurate for this design.
- **Synthesis and place-and-route figures:** tool estimates for one device. No board was programmed.
- **Energy:** not measured.
- **Fixtures:** synthetic or hand-written test data only.

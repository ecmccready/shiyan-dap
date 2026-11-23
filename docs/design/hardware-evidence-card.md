# Hardware Evidence Card — 4D-SCP

Status: complementary, unwired, synthetic/fixture data only.  
Level 4 plant is untouched. 4D-SCP is imported by no production route.

## Adjacent possible (preserved)

1. Specialized accelerator under the existing Aethel Node / Shiyan DAP closed loop that performs the state-compression and event-driven update work the software path currently does.
2. Hybrid engine selector whose advantage is measurable on low-to-medium churn and that correctly degrades or switches on high churn (H5 crossover already shown in simulation).
3. FPGA-first path (ECP5) that can later move to ASIC if the simulation and synthesis advantages hold under real power and timing measurement.

## What is measured today

- Bit-exact RTL simulation (Icarus) against the integer golden model on labelled synthetic fixtures.
- Multi-seed H1–H5 verdicts (H1 PASS, H2 PASS, H3 PASS, H4 MIXED, H5 PASS — high-churn crossover shown).
- Synthesis and place-and-route estimates on Lattice ECP5 (LFE5U-45F) via Yosys + nextpnr: LUT, FF, Fmax, values/s.
- Explicit labels: cycle counts measured in simulation; energy and area are model or synthesis estimates; power not measured; no programmed board results.

## Reproduce

```bash
npx tsx scripts/check-scp-all.ts
# individual reports: fixtures/scp/v0*.json
# Medicare case card — medicare.case.payment_vs_charge.v1

- **Domain label:** medicare (never feeds Safety).
- **Dataset:** CMS Medicare Physician & Other Practitioners — by Provider and Service (public use file, utilization and payment). The demo uses a synthetic fixture shaped like this file (`fixtures/medicare/sample-rows.json`); no live CMS fetch, no real providers, no PHI.
- **Anomaly class:** `payment_vs_charge.v1` (average Medicare payment exceeds average submitted charge when both are present) plus `required_nonnegative.v1` data-quality findings.
- **Why:** deterministic, explainable, human-reviewable, needs no PHI, reuses the existing checks.
- **Human-in-the-loop flow:** checks → evidence pack (`aethel.medicare.evidence.v1`) → reviewer sets `needs_human_review` / `cleared_pattern_only` / `unreviewed` → investigation report (`aethel.medicare.investigation.v1`, recomputable `report_hash`).
- **Pilot metrics (display only, no data yet):** reviewer time per item, precision, false positives (cleared_pattern_only), reproducibility of hashes.
- **Guardrail:** Detected pattern ≠ verified conclusion. Nothing asserts fraud, misconduct or clinical misdiagnosis.

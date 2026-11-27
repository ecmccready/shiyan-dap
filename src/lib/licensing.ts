/** Published licensing and trajectory copy. The boundary check compares these strings to LICENSE and README.md. */
export const OWNER_CONTACT_URL = "https://github.com/ecmccready";
export const PILOT_PATH = "/workbench/pilot";

export const LICENSE_TITLE = "Shiyan DAP / Aethel Node - Source-Available License";
export const LICENSE_COPYRIGHT = "Copyright (c) 2026 ECMcCready. All rights reserved except as stated below.";
export const PACKAGE_LICENSE = "SEE LICENSE IN LICENSE";

export const LICENSING_TITLE = "Licensing";

export const LICENSING_PARAGRAPHS = [
  "The source code in this repository is Source-Available for Inspection and Non-Commercial Evaluation.",
  "Prospective enterprise customers, hardware partners, and investors are welcome to inspect the codebase, run the local verification scripts (scripts/check-scp-all.ts), and evaluate the architecture.",
  "Commercial Use & Pilots:",
  "Production deployment, commercial integration, and IP licensing of the Aethel Node engine, 4D State Compression (M1–M5), and 4D-SCP RTL/models require a paid pilot agreement or commercial license. To initiate a 30-day Proof-to-Pilot or request an enterprise evaluation license, contact https://github.com/ecmccready or visit /workbench/pilot.",
] as const;

export const TRAJECTORY_TITLE = "Trajectory";

export const TRAJECTORY_PARAGRAPHS = [
  "Software: Level 4 plant + M1–M5 4D state-compression engine remain the production core. Commercial surfaces (compute-proof, offer, journey, pilot) convert after measured proof. Payment follows verified improvement.",
  "Chip / board path: 4D-SCP (including the v0.1.30 hybrid and the v0.1.31 Versa bitstream) stays unwired and synthetic-only until a paid pilot or commercial license is in place. Physical board runs and power measurement remain \"needs real board\". The virtual-chip evidence ledger (fixtures/virtual-chip/ledger.json) is the reproducible baseline for any future hardware engagement. Not yet physically validated.",
  "Boundaries unchanged: no PHI, no clinical claims, Level 4 plant untouched, 4D-SCP not imported by any production route.",
] as const;

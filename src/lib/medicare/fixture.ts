/** The committed SYNTHETIC Medicare-style fixture, its provenance and its DQ report (pure, computed from the import). */
import sample from "../../../fixtures/medicare/sample-rows.json";
import { buildProvenance } from "@/lib/medicare/provenance";
import { checkRequiredNonNegative } from "@/lib/medicare/dq";
import { runBaselines } from "@/lib/medicare/baselines";
import { buildEvidencePack } from "@/lib/medicare/evidence";

export const MEDICARE_FIXTURE = sample;
export const FIXTURE_PROVENANCE = buildProvenance({
  source_id: sample.source_id, source_name: sample.source_name, release_id: sample.release_id, retrieved_at: sample.retrieved_at, data: sample.rows,
});
export const FIXTURE_DQ = checkRequiredNonNegative(sample.rows);
export const FIXTURE_BASELINES = runBaselines(sample.rows);
export const FIXTURE_EVIDENCE = buildEvidencePack({ provenance: FIXTURE_PROVENANCE, dq: FIXTURE_DQ, baselines: FIXTURE_BASELINES, rows: sample.rows });

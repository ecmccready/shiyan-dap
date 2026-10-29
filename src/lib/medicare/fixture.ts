/** The committed SYNTHETIC Medicare-style fixture, its provenance and its DQ report (pure, computed from the import). */
import sample from "../../../fixtures/medicare/sample-rows.json";
import { buildProvenance } from "@/lib/medicare/provenance";
import { checkRequiredNonNegative } from "@/lib/medicare/dq";

export const MEDICARE_FIXTURE = sample;
export const FIXTURE_PROVENANCE = buildProvenance({
  source_id: sample.source_id, source_name: sample.source_name, release_id: sample.release_id, retrieved_at: sample.retrieved_at, data: sample.rows,
});
export const FIXTURE_DQ = checkRequiredNonNegative(sample.rows);

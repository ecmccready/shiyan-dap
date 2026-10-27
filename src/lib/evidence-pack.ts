import type { ColdRecord } from '@/lib/cold-record';
import { fmtE, type ExperienceEntry } from "@/lib/level4/experience-client";

/** Shared evidence-pack builders (plain text and Markdown) for a run entry. */
export function packUrls(origin: string, runId: string) {
  const q = encodeURIComponent(runId);
  return {
    origin,
    proof: `${origin}/workbench/result?run_id=${q}`,
    verify: `${origin}/api/level4/verify?run_id=${q}`,
    anchor: `${origin}/api/level4/anchor?run_id=${q}`,
    ledger: `${origin}/api/level4/experience?format=ledger&run_id=${q}`,
    evidence: `${origin}/api/level4/experience?run_id=${q}`,
    assetMap: `${origin}/api/v1/ledger/assets`,
    auditSummary: `${origin}/api/v1/audit/summary`,
  };
}

export function buildPlainPack(entry: ExperienceEntry, line: string | null, origin: string): string {
  const { proof, verify, anchor, assetMap, auditSummary } = packUrls(origin, entry.run_id);
  return [
    `run=${entry.run_id}`,
    `e=${fmtE(entry.e)}`,
    ...(typeof entry.delta_e === "number" ? [`Δe=${fmtE(entry.delta_e)}`] : []),
    ...(typeof entry.phi === "number" ? [`Φ=${fmtE(entry.phi)}`] : []),
    ...(line ? [`ledger: ${line}`] : []),
    `proof: ${proof}`,
    `verify: ${verify}`,
    `anchor (dry run): ${anchor}`,
    `asset map: ${assetMap}`,
    `audit summary: ${auditSummary}`,
  ].join("\n");
}

export function buildMarkdownPack(entry: ExperienceEntry, line: string | null, origin: string): string {
  const { proof, verify, anchor, assetMap, auditSummary } = packUrls(origin, entry.run_id);
  return [
    `### Shiyan evidence — run ${entry.run_id}`,
    "",
    `- e: ${fmtE(entry.e)}`,
    ...(typeof entry.delta_e === "number" ? [`- Δe: ${fmtE(entry.delta_e)}`] : []),
    ...(typeof entry.phi === "number" ? [`- Φ: ${fmtE(entry.phi)}`] : []),
    ...(line ? ["", "```", line, "```"] : []),
    "",
    `[Proof](${proof}) · [Verify](${verify}) · [Anchor (dry run)](${anchor}) · [Asset map](${assetMap}) · [Audit summary](${auditSummary})`,
  ].join("\n");
}

export function buildJsonPack(entry: ExperienceEntry, line: string | null, origin: string): string {
  const { proof, verify, anchor, assetMap, auditSummary } = packUrls(origin, entry.run_id);
  return JSON.stringify(
    {
      run_id: entry.run_id,
      e: entry.e,
      delta_e: typeof entry.delta_e === "number" ? entry.delta_e : null,
      phi: typeof entry.phi === "number" ? entry.phi : null,
      ledger_line: line ?? null,
      proof_url: proof,
      verify_url: verify,
      anchor_url: anchor,
      asset_map_url: assetMap,
      audit_summary_url: auditSummary,
    },
    null,
    2,
  );
}

/**
 * The downloadable evidence pack: measured values, baseline fields the engine recorded, every verification and summary link,
 * and plain disclosures (failed checks, missing values, what the pack does not contain). It organizes what the engine recorded;
 * the verify endpoint, not this file, is the authority.
 */
export function buildDownloadPack(
  entry: ExperienceEntry,
  line: string | null,
  origin: string,
  benefit?: { amount: string; unit: string; note: string; recorded_at: string; ledger?: { txHash: string; assetId: string; recorded_at: string; amount: string; unit: string; note: string } } | null,
  mcpCold?: ColdRecord | null,
): string {
  const u = packUrls(origin, entry.run_id);
  const disclosures: string[] = [];
  if (!entry.eligible) disclosures.push('This run is not eligible: the goal threshold was not met. No Φ claim is made for it.');
  if (typeof entry.phi !== 'number') disclosures.push('Φ is not recorded for this entry.');
  if (typeof entry.delta_e !== 'number') disclosures.push('Δe is not recorded for this entry.');
  if (!line) disclosures.push('The eligible ledger line could not be loaded when this pack was exported; use the ledger link.');
  disclosures.push('The anchor link is a dry run: nothing is submitted on-chain.');
  disclosures.push('The audit summary is a heuristic mock scan of the off-chain micro-ledger, not a third-party attestation, and its Merkle root is not anchored on-chain.');
  if (benefit) {
    disclosures.push('The economic benefit in this pack is self-reported by the customer, was stored in their browser and is not verified by the engine or the ledger.');
    if (benefit.ledger) disclosures.push(`The customer also chose to record this benefit on the ledger as an unsigned ECONOMIC_BENEFIT event (tx ${benefit.ledger.txHash}). The ledger shows that the entry was recorded, not that it is true; its signature status is unverified.`);
    disclosures.push('The declared goal and baseline cost are not part of this pack. Re-check every value with the verify link.');
  } else {
    disclosures.push('The declared goal, baseline cost and the customer\'s actual economic benefit are not part of this pack; they are recorded outside the engine. Re-check every value with the verify link.');
  }
  disclosures.push(mcpCold
    ? 'The mcp_cold_comparison block is a separate MCP-plant check run in this browser, not part of this Level 4 run and not verified by the verify link. It compares the B1 sealed sequence with a greedy cold controller over MCP, which is not the Safety-proof Self().' + (mcpCold.error_win ? '' : ' In that check the sealed sequence did not beat the cold run, so no error win is claimed for it.')
    : 'No MCP cold comparison was run in this browser, so the pack contains none. It is available on the peer and compare pages; on B1 the sealed sequence currently does not beat the cold run (0.235 vs 0.184), so it is not an error win.');
  return JSON.stringify(
    {
      kind: 'shiyan-evidence-pack',
      version: 1,
      generated_at: new Date().toISOString(),
      run_id: entry.run_id,
      measured: {
        e: entry.e,
        e0_baseline: entry.e0 ?? null,
        cold_e: entry.cold_e ?? null,
        delta_e: typeof entry.delta_e === 'number' ? entry.delta_e : null,
        phi: typeof entry.phi === 'number' ? entry.phi : null,
        eligible: entry.eligible,
        state: entry.state ?? null,
        iteration: entry.iteration,
        verified_at: entry.verified_at,
      },
      tensor: entry.tensor_commitment
        ? { commitment: entry.tensor_commitment, distance: entry.tensor_distance ?? null, bound: entry.tensor_bound ?? null, max_allowable: entry.tensor_max_allowable ?? null }
        : null,
      ledger_line: line ?? null,
      self_reported_economic_benefit: benefit
        ? { amount: benefit.amount || null, unit: benefit.unit || null, note: benefit.note || null, recorded_at: benefit.recorded_at, self_reported: true, verified: false, ledger_event: benefit.ledger ? { tx_hash: benefit.ledger.txHash, asset_id: benefit.ledger.assetId, domain: 'ECONOMIC_BENEFIT', recorded_at: benefit.ledger.recorded_at, amount: benefit.ledger.amount || null, unit: benefit.ledger.unit || null, note: benefit.ledger.note || null, signature_status: 'unverified' } : null }
        : null,
      mcp_cold_comparison: mcpCold
        ? { available: true, plant: 'B1', scope: 'MCP plant, measured in this browser on a fresh case; not tied to this run', page: mcpCold.page, case_id: mcpCold.case_id, start_e: mcpCold.start_e, cold_final_e: mcpCold.cold_final_e, cold_sequence: mcpCold.cold_sequence, sealed_sequence_final_e: mcpCold.sealed_final_e, phi: mcpCold.phi, error_win: mcpCold.error_win, verdict: mcpCold.error_win ? 'error win vs the greedy cold run (sealed final e strictly below cold final e)' : 'not a win: sealed final e is not strictly below the cold final e', recorded_at: mcpCold.recorded_at }
        : { available: false, plant: 'B1', note: 'No cold run was made in this browser. Run it with the opt-in checkbox on the peer or compare page. Last known result: sealed 0.235 vs cold 0.184, Φ −0.051, not an error win.', links: [u.origin + '/workbench/peer', u.origin + '/workbench/compare'] },
      links: {
        proof: u.proof,
        verify: u.verify,
        anchor_dry_run: u.anchor,
        ledger: u.ledger,
        evidence_export: u.evidence,
        asset_map: u.assetMap,
        audit_summary: u.auditSummary,
      },
      disclosures,
    },
    null,
    2,
  );
}

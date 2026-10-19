import { fmtE, type ExperienceEntry } from "@/lib/level4/experience-client";

/** Shared evidence-pack builders (plain text and Markdown) for a run entry. */
export function packUrls(origin: string, runId: string) {
  const q = encodeURIComponent(runId);
  return { proof: `${origin}/workbench/result?run_id=${q}`, verify: `${origin}/api/level4/verify?run_id=${q}` };
}

export function buildPlainPack(entry: ExperienceEntry, line: string | null, origin: string): string {
  const { proof, verify } = packUrls(origin, entry.run_id);
  return [
    `run=${entry.run_id}`,
    `e=${fmtE(entry.e)}`,
    ...(typeof entry.delta_e === "number" ? [`Δe=${fmtE(entry.delta_e)}`] : []),
    ...(typeof entry.phi === "number" ? [`Φ=${fmtE(entry.phi)}`] : []),
    ...(line ? [`ledger: ${line}`] : []),
    `proof: ${proof}`,
    `verify: ${verify}`,
  ].join("\n");
}

export function buildMarkdownPack(entry: ExperienceEntry, line: string | null, origin: string): string {
  const { proof, verify } = packUrls(origin, entry.run_id);
  return [
    `### Shiyan evidence — run ${entry.run_id}`,
    "",
    `- e: ${fmtE(entry.e)}`,
    ...(typeof entry.delta_e === "number" ? [`- Δe: ${fmtE(entry.delta_e)}`] : []),
    ...(typeof entry.phi === "number" ? [`- Φ: ${fmtE(entry.phi)}`] : []),
    ...(line ? ["", "```", line, "```"] : []),
    "",
    `[Proof](${proof}) · [Verify](${verify})`,
  ].join("\n");
}

export function buildJsonPack(entry: ExperienceEntry, line: string | null, origin: string): string {
  const { proof, verify } = packUrls(origin, entry.run_id);
  return JSON.stringify(
    {
      run_id: entry.run_id,
      e: entry.e,
      delta_e: typeof entry.delta_e === "number" ? entry.delta_e : null,
      phi: typeof entry.phi === "number" ? entry.phi : null,
      ledger_line: line ?? null,
      proof_url: proof,
      verify_url: verify,
    },
    null,
    2,
  );
}

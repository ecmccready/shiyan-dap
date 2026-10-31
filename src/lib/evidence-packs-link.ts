/** Display-only: shared target for the "Evidence packs →" chips on Medicare and look-back. */
export const EVIDENCE_PACKS_HREF = "/workbench/offer#evidence-packs";
export function evidencePacksChipLabel(scope: "medicare" | "lookback"): string {
  return scope === "medicare" ? "Medicare · Evidence packs →" : "Evidence packs →";
}

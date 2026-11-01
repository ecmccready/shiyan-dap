"use client";

import { useCopy, copiedRing } from "@/lib/use-copy";
import { MEDICARE_PACK_COPIED_EVENT, medicareInvestigationJsonWithViewUrl, medicareEvidenceJsonWithViewUrl, medicareProvenanceJsonWithViewUrl, medicareBaselinesJsonWithViewUrl, medicareDqJsonWithViewUrl } from "@/lib/medicare/investigation";
import { medicareShareableViewUrl, resolveMedicareLiveKeyTarget } from "@/lib/medicare/view-url";

/** Copies a precomputed medicare-labeled JSON string (synthetic fixture) to the local clipboard. Nothing is sent. */
export default function CopyMedicareJson({ json, label, kind, ids }: { json: string; label: string; ids?: readonly string[]; kind: "investigation" | "evidence" | "brief" | "provenance" | "baselines" | "dq" }) {
  const copy = useCopy(4000, undefined, `medicare ${kind}`);
  return (
    <button
      type="button"
      data-copy-medicare-json={kind}
      onClick={() => { let out = json; if (kind === "investigation" || kind === "evidence" || kind === "provenance" || kind === "baselines" || kind === "dq") { try { let st: Storage | null = null; try { st = window.sessionStorage; } catch {} const t = resolveMedicareLiveKeyTarget(st, window.location.search, ids); out = (kind === "evidence" ? medicareEvidenceJsonWithViewUrl : kind === "provenance" ? medicareProvenanceJsonWithViewUrl : kind === "baselines" ? medicareBaselinesJsonWithViewUrl : kind === "dq" ? medicareDqJsonWithViewUrl : medicareInvestigationJsonWithViewUrl)(json, medicareShareableViewUrl(window.location.href, t)) || json; } catch {} } void copy.copy(out).then((ok) => { if (ok) window.dispatchEvent(new CustomEvent(MEDICARE_PACK_COPIED_EVENT, { detail: kind })); }); }}
      className={`inline-flex h-9 items-center rounded-full border border-zinc-600 px-4 text-xs text-zinc-200 hover:border-zinc-400${copiedRing(copy.status)}`}
    >
      {copy.status === "copied" ? "Copied ✓" : copy.status === "failed" ? "Copy failed" : label}
    </button>
  );
}

"use client";

import { useCopy, copiedRing } from "@/lib/use-copy";
import { MEDICARE_PACK_COPIED_EVENT, medicareInvestigationJsonWithViewUrl, medicareEvidenceJsonWithViewUrl, medicareProvenanceJsonWithViewUrl, medicareBaselinesJsonWithViewUrl } from "@/lib/medicare/investigation";
import { parseMedicareUrlView, medicareUrlWithView } from "@/lib/medicare/view-url";

/** Copies a precomputed medicare-labeled JSON string (synthetic fixture) to the local clipboard. Nothing is sent. */
export default function CopyMedicareJson({ json, label, kind }: { json: string; label: string; kind: "investigation" | "evidence" | "brief" | "provenance" | "baselines" | "dq" }) {
  const copy = useCopy(4000, undefined, `medicare ${kind}`);
  return (
    <button
      type="button"
      data-copy-medicare-json={kind}
      onClick={() => { let out = json; if (kind === "investigation" || kind === "evidence" || kind === "provenance" || kind === "baselines") { try { const v = parseMedicareUrlView(window.location.search); out = (kind === "evidence" ? medicareEvidenceJsonWithViewUrl : kind === "provenance" ? medicareProvenanceJsonWithViewUrl : kind === "baselines" ? medicareBaselinesJsonWithViewUrl : medicareInvestigationJsonWithViewUrl)(json, medicareUrlWithView(window.location.href, { filter: v.filter ?? null, packs: !!v.packs, jumps: !!v.jumps })) || json; } catch {} } void copy.copy(out).then((ok) => { if (ok) window.dispatchEvent(new CustomEvent(MEDICARE_PACK_COPIED_EVENT, { detail: kind })); }); }}
      className={`inline-flex h-9 items-center rounded-full border border-zinc-600 px-4 text-xs text-zinc-200 hover:border-zinc-400${copiedRing(copy.status)}`}
    >
      {copy.status === "copied" ? "Copied ✓" : copy.status === "failed" ? "Copy failed" : label}
    </button>
  );
}

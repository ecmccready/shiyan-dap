import Link from "next/link";
import { EVIDENCE_PACKS_HREF, evidencePacksChipLabel } from "@/lib/evidence-packs-link";

/** Display-only link chip to /workbench/offer#evidence-packs (shared by Medicare + look-back). */
export default function EvidencePacksChip({ scope }: { scope: "medicare" | "lookback" }) {
  const cls = scope === "medicare" ? "px-3 py-1 text-xs" : "px-2 py-0.5";
  return (
    <Link data-evidence-packs-chip={scope} href={EVIDENCE_PACKS_HREF}
      className={`inline-flex w-fit items-center rounded-full border border-sky-700 bg-sky-950/40 ${cls} font-semibold text-sky-300 hover:bg-sky-900/50`}>
      {evidencePacksChipLabel(scope)}
    </Link>
  );
}

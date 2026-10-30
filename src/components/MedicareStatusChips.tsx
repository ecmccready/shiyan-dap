"use client";

import { useEffect, useState } from "react";
import { MEDICARE_REPORT_EVENT, statusChips, type InvestigationReport } from "@/lib/medicare/investigation";
import { medicareAnchorId } from "@/lib/medicare/case-brief";

const TONE = {
  unreviewed: "border-zinc-500 text-zinc-200 bg-zinc-800",
  needs_human_review: "border-amber-400 text-black bg-amber-400",
  cleared_pattern_only: "border-emerald-400 text-black bg-emerald-400",
} as const;

/** Per-item status chips; follow the disposition stub's tab-local report event. Each links to its disposition row. */
export default function MedicareStatusChips({ initial }: { initial: InvestigationReport }) {
  const [r, setR] = useState<InvestigationReport>(initial);
  useEffect(() => {
    const on = (ev: Event) => { const d = (ev as CustomEvent<InvestigationReport>).detail; if (d && Array.isArray(d.entries)) setR(d); };
    window.addEventListener(MEDICARE_REPORT_EVENT, on);
    return () => window.removeEventListener(MEDICARE_REPORT_EVENT, on);
  }, []);
  return (
    <div data-medicare-status-chips className="flex flex-wrap gap-2">
      {statusChips(r).map((c) => (
        <a key={c.item_id} href={`#${medicareAnchorId("disposition", c.item_id)}`} data-medicare-status-chip={c.status} title={c.item_id}
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${TONE[c.status]}`}>{c.label}</a>
      ))}
    </div>
  );
}

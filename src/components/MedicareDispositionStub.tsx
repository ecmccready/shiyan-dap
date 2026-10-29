"use client";

import { useMemo, useState } from "react";
import { applyDisposition, buildInvestigationReport, DISPOSITION_STATUSES, type DispositionInput } from "@/lib/medicare/investigation";
import type { EvidencePack } from "@/lib/medicare/evidence";

/** Client-only disposition stub over the synthetic fixture. State lives in this tab; nothing is stored or sent. */
export default function MedicareDispositionStub({ pack }: { pack: EvidencePack }) {
  const [disp, setDisp] = useState<DispositionInput>({});
  const report = useMemo(() => buildInvestigationReport({ pack, dispositions: disp }), [pack, disp]);
  return (
    <div data-medicare-disposition-stub className="space-y-2">
      <p className="text-emerald-400 text-xs">Reviewer disposition (stub, this tab only)</p>
      <ul className="space-y-1 text-xs font-mono text-zinc-300">
        {report.entries.map((e) => (
          <li key={e.item_id} className="flex flex-wrap items-center gap-2">
            <span>{e.item_id}</span>
            <select
              aria-label={`Disposition for ${e.item_id}`}
              data-medicare-disposition={e.item_id}
              value={e.status}
              onChange={(ev) => setDisp((d) => applyDisposition(d, e.item_id, ev.target.value))}
              className="bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5"
            >
              {DISPOSITION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </li>
        ))}
      </ul>
      <p className="text-xs font-mono text-zinc-400 break-all" data-medicare-live-report-hash>
        report sha256 {report.report_hash} · {report.counts.unreviewed} unreviewed, {report.counts.needs_human_review} needs_human_review, {report.counts.cleared_pattern_only} cleared_pattern_only
      </p>
      <button type="button" onClick={() => setDisp({})} className="text-xs underline text-zinc-400">Reset</button>
    </div>
  );
}

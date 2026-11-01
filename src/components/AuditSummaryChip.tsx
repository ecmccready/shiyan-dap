"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export const AUDIT_SUMMARY_HREF = "/workbench/audit";
export const LOOKBACK_AUDIT_CHIP_PULSE_KEY = "aethel.lookback.auditChip.pulsed";

/** Link chip to /workbench/audit (shared by Medicare + look-back sticky strips).
 *  Optional firstUsePulseKey: pulses once per browser session on first mount (sessionStorage flag); display-only. */
export default function AuditSummaryChip({ scope, firstUsePulseKey }: { scope: "medicare" | "lookback"; firstUsePulseKey?: string }) {
  const cls = scope === "medicare" ? "px-3 py-1 text-xs" : "px-2 py-0.5";
  const [pulsing, setPulsing] = useState(false);
  useEffect(() => {
    if (!firstUsePulseKey) return;
    try {
      if (window.sessionStorage.getItem(firstUsePulseKey)) return;
      window.sessionStorage.setItem(firstUsePulseKey, "1");
    } catch { return; }
    const on = window.setTimeout(() => setPulsing(true), 0);
    const off = window.setTimeout(() => setPulsing(false), 1600);
    return () => { window.clearTimeout(on); window.clearTimeout(off); };
  }, [firstUsePulseKey]);
  return (
    <Link data-audit-summary-chip={scope} data-first-use-pulse={pulsing ? "on" : undefined} href={AUDIT_SUMMARY_HREF}
      className={`inline-flex w-fit items-center rounded-full border border-violet-700 bg-violet-950/40 ${cls} font-semibold text-violet-300 hover:bg-violet-900/50` + (pulsing ? " animate-pulse ring-2 ring-violet-400/70" : "")}>
      Audit summary →
    </Link>
  );
}

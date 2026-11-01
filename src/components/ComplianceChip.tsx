"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export const COMPLIANCE_HREF = "/workbench/compliance";

/** Link chip to /workbench/compliance (Diagnostics Compliance) (shared by Medicare + look-back sticky strips).
 *  Optional firstUsePulseKey: pulses once per browser session on first mount (sessionStorage flag); display-only. */
export default function ComplianceChip({ scope, firstUsePulseKey }: { scope: "medicare" | "lookback"; firstUsePulseKey?: string }) {
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
    <Link data-compliance-chip={scope} data-first-use-pulse={pulsing ? "on" : undefined} href={COMPLIANCE_HREF}
      className={`inline-flex w-fit items-center rounded-full border border-sky-700 bg-sky-950/40 ${cls} font-semibold text-sky-300 hover:bg-sky-900/50` + (pulsing ? " animate-pulse ring-2 ring-sky-400/70" : "")}>
      Compliance →
    </Link>
  );
}

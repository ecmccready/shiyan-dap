"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export const ASSET_MAP_HREF = "/workbench/assets";
export const LOOKBACK_ASSET_MAP_CHIP_PULSE_KEY = "aethel.lookback.assetMapChip.pulsed";
export const MEDICARE_ASSET_MAP_CHIP_PULSE_KEY = "aethel.medicare.assetMapChip.pulsed";

/** Link chip to /workbench/assets (shared by Medicare + look-back sticky strips).
 *  Optional firstUsePulseKey: pulses once per browser session on first mount (sessionStorage flag); display-only. */
export default function AssetMapChip({ scope, firstUsePulseKey }: { scope: "medicare" | "lookback"; firstUsePulseKey?: string }) {
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
    <Link data-asset-map-chip={scope} data-first-use-pulse={pulsing ? "on" : undefined} href={ASSET_MAP_HREF}
      className={`inline-flex w-fit items-center rounded-full border border-teal-700 bg-teal-950/40 ${cls} font-semibold text-teal-300 hover:bg-teal-900/50` + (pulsing ? " animate-pulse ring-2 ring-teal-400/70" : "")}>
      Asset map →
    </Link>
  );
}

"use client";

import { useState } from "react";
import { useCopy, copiedRing } from "@/lib/use-copy";
import { showToast } from "@/lib/toast";

/** Copies a displayed value as shown; shares the page-wide Copied state and the toast. */
export default function CopyValue({ value, label, toast, firstUsePulseKey }: { value: string; label: string; toast?: string; firstUsePulseKey?: string }) {
  const { status, copy } = useCopy(4000, undefined, label);
  const [pulsing, setPulsing] = useState(false);
  // Optional first-use pulse: once per browser session (sessionStorage flag), success only.
  const maybePulse = () => {
    if (!firstUsePulseKey) return;
    try {
      if (window.sessionStorage.getItem(firstUsePulseKey)) return;
      window.sessionStorage.setItem(firstUsePulseKey, "1");
    } catch { /* storage unavailable: skip pulse */ return; }
    setPulsing(true);
    window.setTimeout(() => setPulsing(false), 1200);
  };
  return (
    <button
      type="button"
      onClick={async () => { const ok = await copy(value); if (ok) maybePulse(); showToast(ok ? (toast ?? `${label} copied`) : `${label} copy failed`); }}
      data-first-use-pulse={pulsing ? "on" : undefined}
      className={"ml-2 rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-emerald-400 font-sans" + copiedRing(status) + (pulsing ? " animate-pulse ring-2 ring-emerald-400/70" : "")}
      title={`Copy ${label}`}
    >
      {status === "copied" ? "Copied ✓" : status === "failed" ? "Copy failed" : `Copy ${label}`}
    </button>
  );
}

"use client";

import { useEffect, useState } from "react";
import { clearCopied, getLastCopiedLabel, useLastCopied } from "@/lib/use-copy";

/**
 * Small sticky "Copied: <label> · Clear" pill (bottom-right, just above the
 * toast area). Shown only while some copy button is in the Copied state; the
 * single Clear control on every Level 4 page. Escape clears; the pill can be
 * collapsed to a small "Copied ✓" pill and expanded again.
 */
export default function ClearCopied() {
  const last = useLastCopied();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (!last) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") clearCopied(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last]);
  if (!last) return null;
  const label = getLastCopiedLabel();
  if (collapsed) {
    return (
      <button
        type="button"
        data-copied-toolbar=""
        onClick={() => setCollapsed(false)}
        className="fixed bottom-20 right-4 z-[9998] rounded-full border border-emerald-600 bg-zinc-900 px-2.5 py-1 text-xs text-emerald-400 shadow-lg font-sans"
        title="Expand the Copied toolbar (Esc to clear)"
        aria-label="Expand the Copied toolbar"
      >
        Copied ✓
      </button>
    );
  }
  return (
    <div
      data-copied-toolbar=""
      className="fixed bottom-20 right-4 z-[9998] flex items-center gap-2 rounded-full border border-emerald-600 bg-zinc-900 px-3 py-1.5 text-xs text-white shadow-lg font-sans"
    >
      <span>
        Copied{label ? ": " : ""}
        {label && <span className="text-emerald-400">{label}</span>}
      </span>
      <button
        type="button"
        onClick={clearCopied}
        className="rounded-full border border-zinc-600 px-2 py-0.5 text-zinc-200 hover:border-zinc-400"
        title="Reset the Copied state on all buttons"
      >
        Clear
      </button>
      <span className="text-zinc-500">Esc to clear</span>
      <button
        type="button"
        onClick={() => setCollapsed(true)}
        className="rounded-full px-1.5 text-zinc-400 hover:text-zinc-200"
        title="Collapse the toolbar"
        aria-label="Collapse the Copied toolbar"
      >
        –
      </button>
    </div>
  );
}

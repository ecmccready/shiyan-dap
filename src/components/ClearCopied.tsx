"use client";

import { clearCopied, getLastCopiedLabel, useLastCopied } from "@/lib/use-copy";

/**
 * Small sticky "Copied: <label> · Clear" pill (bottom-right, just above the
 * toast area). Shown only while some copy button is in the Copied state; the
 * single Clear control on every Level 4 page.
 */
export default function ClearCopied() {
  const last = useLastCopied();
  if (!last) return null;
  const label = getLastCopiedLabel();
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
    </div>
  );
}

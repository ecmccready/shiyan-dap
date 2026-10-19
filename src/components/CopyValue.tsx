"use client";

import { useCopy, copiedRing } from "@/lib/use-copy";
import { showToast } from "@/lib/toast";

/** Copies a displayed value as shown; shares the page-wide Copied state and the toast. */
export default function CopyValue({ value, label }: { value: string; label: string }) {
  const { status, copy } = useCopy();
  return (
    <button
      type="button"
      onClick={async () => showToast((await copy(value)) ? `${label} copied` : `${label} copy failed`)}
      className={"ml-2 rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-emerald-400 font-sans" + copiedRing(status)}
      title={`Copy ${label}`}
    >
      {status === "copied" ? "Copied ✓" : status === "failed" ? "Copy failed" : `Copy ${label}`}
    </button>
  );
}

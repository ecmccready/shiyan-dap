"use client";

import { clearCopied, useLastCopied } from "@/lib/use-copy";

/** Small text button shown only while some copy button is in the Copied state. */
export default function ClearCopied() {
  const last = useLastCopied();
  if (!last) return null;
  return (
    <button
      type="button"
      onClick={clearCopied}
      className="ml-2 text-xs text-zinc-400 underline hover:text-zinc-200 font-sans"
      title="Reset the Copied state on all buttons"
    >
      Clear copied
    </button>
  );
}

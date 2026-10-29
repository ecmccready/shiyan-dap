"use client";

import { useCopy, copiedRing } from "@/lib/use-copy";

/** Copies a precomputed medicare-labeled JSON string (synthetic fixture) to the local clipboard. Nothing is sent. */
export default function CopyMedicareJson({ json, label, kind }: { json: string; label: string; kind: "investigation" | "evidence" }) {
  const copy = useCopy(4000, undefined, `medicare ${kind}`);
  return (
    <button
      type="button"
      data-copy-medicare-json={kind}
      onClick={() => void copy.copy(json)}
      className={`inline-flex h-9 items-center rounded-full border border-zinc-600 px-4 text-xs text-zinc-200 hover:border-zinc-400${copiedRing(copy.status)}`}
    >
      {copy.status === "copied" ? "Copied ✓" : copy.status === "failed" ? "Copy failed" : label}
    </button>
  );
}

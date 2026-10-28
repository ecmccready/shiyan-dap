"use client";

import { useCopy, copiedRing } from "@/lib/use-copy";

/** Plain-text summary of what an outside party can verify today. Keep in sync with ExternalConfirmation and the README. */
export function verificationSummary(origin: string): string {
  return [
    "Aethel Node: what an outside party can verify today",
    "",
    `- Safety-proof error wins (recomputed in your browser): Φ 0.014, 0.065 and 0.065. ${origin}/workbench/proof`,
    `- MCP commercial case: Φ +0.159 (sealed sequence 0.171 vs a greedy cold run at 0.33) on a starting plant we constructed, not customer data. On B1's default start the same comparison is Φ −0.051, not a win. ${origin}/workbench/compare`,
    `- Evidence pack export: ${origin}/workbench/result`,
    `- Recorded-run replay: ${origin}/api/level4/verify?run_id=run_mvmt18dm_dpbybz`,
    "",
    "Not yet confirmed: no paid pilot, no customer validation, no third-party attestation, and the anchor is a dry run.",
    `Full list: ${origin}/workbench/offer`,
  ].join("\n");
}

/** Copies the verification summary as plain text. Shared by the homepage, /workbench/offer and /workbench/pilot. */
export default function CopyVerificationSummary({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const copy = useCopy(4000, undefined, "verification summary");
  const style =
    tone === "dark"
      ? "border-zinc-700 text-zinc-200 hover:border-zinc-500"
      : "border-neutral-400 text-neutral-800 hover:border-neutral-600";
  return (
    <button
      type="button"
      data-copy-verification-summary
      onClick={() => void copy.copy(verificationSummary(window.location.origin))}
      className={`mt-3 inline-flex h-9 items-center rounded-full border px-4 text-xs ${style}${copiedRing(copy.status)}`}
    >
      {copy.status === "copied" ? "Copied ✓" : copy.status === "failed" ? "Copy failed" : "Copy verification summary"}
    </button>
  );
}

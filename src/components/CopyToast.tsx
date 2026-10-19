"use client";

/** Tiny fixed bottom-center toast for copy feedback; visible while status != idle. */
export default function CopyToast({
  status,
  copied,
  failed = "Copy failed — use the link",
}: {
  status: "idle" | "copied" | "failed";
  copied: string;
  failed?: string;
}) {
  const msg = status === "copied" ? copied : status === "failed" ? failed : "";
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-emerald-700 bg-zinc-900 px-4 py-2 text-sm text-emerald-300 shadow-lg transition-opacity ${msg ? "opacity-100" : "opacity-0"}`}
    >
      {msg}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import CopyToast from "@/components/CopyToast";

/**
 * Copies a stable public URL for a run (/workbench/result?run_id=<id>) to the
 * clipboard. Tries the Clipboard API, then a hidden-textarea execCommand copy;
 * the open-link stays as the fallback either way.
 */
function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function ShareResult({ runId }: { runId: string | null | undefined }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  if (!runId) return null;
  const path = `/workbench/result?run_id=${encodeURIComponent(runId)}`;

  async function copy() {
    const url = new URL(path, window.location.origin).toString();
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) ok = legacyCopy(url);
    setStatus(ok ? "copied" : "failed");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), ok ? 2000 : 4000);
  }

  return (
    <p className="text-sm space-x-3">
      <button type="button" onClick={copy} className="rounded-full border border-emerald-700 px-3 py-1 text-emerald-400">
        {status === "copied" ? "Copied ✓" : "Share this result"}
      </button>
      <a href={path} className="underline text-emerald-400">Open public link →</a>
      <span role="status" aria-live="polite" className="text-xs text-zinc-400">
        {status === "copied" ? "Link copied" : status === "failed" ? "Copy failed — use the link" : ""}
      </span>
      <CopyToast status={status} copied="Public link copied" />
    </p>
  );
}

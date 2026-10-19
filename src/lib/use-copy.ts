"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

/** Hidden-textarea execCommand copy; fallback when the Clipboard API fails. */
export function legacyCopy(text: string): boolean {
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

/**
 * Page-wide "last copied" key: whichever copy button copied most recently
 * shows "Copied" until the next successful copy anywhere on the page.
 */
let lastCopiedKey: string | null = null;
let lastCopiedLabel: string | null = null;
const listeners = new Set<() => void>();
function setLastCopied(key: string | null, label: string | null = null) {
  lastCopiedKey = key;
  lastCopiedLabel = key ? label : null;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
const getSnapshot = () => lastCopiedKey;
const getServerSnapshot = () => null;

/**
 * Copy with Clipboard API → execCommand fallback. A successful copy stays
 * "copied" until another copy (any button) succeeds; failures show briefly.
 */
export function useCopy(failResetMs = 4000, key?: string, label?: string) {
  const autoKey = useId();
  const myKey = key ?? autoKey;
  const last = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copy(text: string) {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) ok = legacyCopy(text);
    if (timer.current) clearTimeout(timer.current);
    if (ok) {
      setFailed(false);
      setLastCopied(myKey, label ?? null);
    } else {
      if (lastCopiedKey === myKey) setLastCopied(null);
      setFailed(true);
      timer.current = setTimeout(() => setFailed(false), failResetMs);
    }
    return ok;
  }

  const status: "idle" | "copied" | "failed" = failed ? "failed" : last === myKey ? "copied" : "idle";
  return { status, copy };
}

/** Current page-wide last-copied key (null when nothing is in the Copied state). */
export function useLastCopied() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Human label of the last successful copy (for the Copied toolbar). */
export function getLastCopiedLabel() {
  return lastCopiedLabel;
}

/** Reset the shared Copied state so no button shows "Copied". */
export function clearCopied() {
  setLastCopied(null);
}

/** Extra classes marking the most recently copied button. */
export function copiedRing(status: "idle" | "copied" | "failed") {
  return status === "copied" ? " ring-2 ring-emerald-500 ring-offset-1 ring-offset-zinc-950" : "";
}

"use client";

/**
 * Single shared copy toast, attached directly to <body> so no ancestor
 * transform/overflow/z-index can clip or hide it. A new toast replaces the
 * current one (no stacking). Fully opaque ~2.8s, then fades out over 300ms.
 */
const VISIBLE_MS = 2800;
const FADE_MS = 300;
let el: HTMLDivElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let fadeTimer: ReturnType<typeof setTimeout> | null = null;

function region(): HTMLDivElement {
  if (el && document.body.contains(el)) return el;
  el = document.createElement("div");
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.dataset.copyToast = "";
  Object.assign(el.style, {
    position: "fixed",
    left: "50%",
    bottom: "24px",
    transform: "translateX(-50%)",
    zIndex: "9999",
    background: "#111",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.35)",
    boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
    borderRadius: "8px",
    padding: "10px 16px",
    fontSize: "15px",
    fontWeight: "600",
    lineHeight: "1.3",
    maxWidth: "90vw",
    pointerEvents: "none",
    opacity: "0",
    visibility: "hidden",
    transition: `opacity ${FADE_MS}ms ease`,
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(el);
  return el;
}

export function showToast(message: string) {
  if (typeof document === "undefined") return;
  const t = region();
  if (hideTimer) clearTimeout(hideTimer);
  if (fadeTimer) clearTimeout(fadeTimer);
  t.textContent = message;
  // Show instantly at full opacity (no fade-in from 0 that could be missed).
  t.style.transition = "none";
  t.style.visibility = "visible";
  t.style.opacity = "1";
  void t.offsetHeight;
  t.style.transition = `opacity ${FADE_MS}ms ease`;
  hideTimer = setTimeout(() => {
    t.style.opacity = "0";
    // Keep text until the fade completes, then hide.
    fadeTimer = setTimeout(() => {
      t.style.visibility = "hidden";
      t.textContent = "";
    }, FADE_MS);
  }, VISIBLE_MS);
}

"use client";

import { useEffect, useState } from "react";
import { useCopy, copiedRing } from "@/lib/use-copy";
import { showToast } from "@/lib/toast";
import type { ExperienceEntry } from "@/lib/level4/experience-client";
import { buildPlainPack, buildMarkdownPack, buildJsonPack, packUrls } from "@/lib/evidence-pack";

/**
 * Copies a short multi-line evidence pack for a run: run id, e, Δe, Φ, the
 * latest eligible ledger line (fetched like CopyLedgerLine), public proof URL
 * and verify URL. Hidden when there is no entry.
 */
export default function CopyEvidencePack({ entry }: { entry?: ExperienceEntry | null }) {
  const [line, setLine] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const { status, copy } = useCopy(4000, undefined, "evidence pack");
  const mdCopy = useCopy(4000, undefined, "evidence (Markdown)");
  const urlCopy = useCopy(4000, undefined, "public URL");
  const verifyCopy = useCopy(4000, undefined, "verify URL");
  const jsonCopy = useCopy(4000, undefined, "evidence (JSON)");
  const runId = entry?.run_id;
  const iteration = entry?.iteration;
  useEffect(() => { setOrigin(window.location.origin); }, []);
  useEffect(() => {
    setLine(null);
    if (!runId || typeof iteration !== "number") return;
    let alive = true;
    fetch(`/api/level4/experience?format=ledger&run_id=${encodeURIComponent(runId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { ledger?: unknown } | null) => {
        const lines = Array.isArray(j?.ledger) ? (j!.ledger as unknown[]).filter((l): l is string => typeof l === "string") : [];
        const match = lines.find(
          (l) => / STATUS=ELIGIBLE_EXPERIENCE( |$)/.test(" " + l) && new RegExp(`(^| )ITER=${iteration}( |$)`).test(l),
        );
        if (alive) setLine(match ?? null);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [runId, iteration]);
  if (!entry || !runId) return null;
  const pack = buildPlainPack(entry, line, origin);
  const md = buildMarkdownPack(entry, line, origin);
  const publicUrl = packUrls(origin, runId).proof;
  const verifyUrl = packUrls(origin, runId).verify;
  const json = buildJsonPack(entry, line, origin);
  return (
    <p className="text-xs flex flex-wrap gap-2">
      <button
        type="button"
        onClick={async () => showToast((await copy(pack)) ? "Evidence pack copied" : "Evidence pack copy failed")}
        className={"rounded-full border border-zinc-700 px-3 py-1 text-xs text-emerald-400" + copiedRing(status)}
        title="Run id, e, Δe, Φ, latest eligible ledger line, public proof URL and verify URL"
      >
        {status === "copied" ? "Copied ✓" : status === "failed" ? "Copy failed" : "Copy full evidence pack"}
      </button>
      <button
        type="button"
        onClick={async () => showToast((await mdCopy.copy(md)) ? "Markdown evidence copied" : "Markdown evidence copy failed")}
        className={"rounded-full border border-zinc-700 px-3 py-1 text-xs text-emerald-400" + copiedRing(mdCopy.status)}
        title="Same evidence pack, formatted as simple Markdown"
      >
        {mdCopy.status === "copied" ? "Copied ✓" : mdCopy.status === "failed" ? "Copy failed" : "Copy as Markdown"}
      </button>
      <button
        type="button"
        onClick={async () => showToast((await jsonCopy.copy(json)) ? "JSON evidence copied" : "JSON evidence copy failed")}
        className={"rounded-full border border-zinc-700 px-3 py-1 text-xs text-emerald-400" + copiedRing(jsonCopy.status)}
        title="Same evidence pack as pretty-printed JSON"
      >
        {jsonCopy.status === "copied" ? "Copied ✓" : jsonCopy.status === "failed" ? "Copy failed" : "Copy as JSON"}
      </button>
      <button
        type="button"
        onClick={async () => showToast((await urlCopy.copy(publicUrl)) ? "Public URL copied" : "Public URL copy failed")}
        className={"rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-emerald-400" + copiedRing(urlCopy.status)}
        title="Copy only the public proof URL"
      >
        {urlCopy.status === "copied" ? "Copied ✓" : urlCopy.status === "failed" ? "Copy failed" : "Copy public URL only"}
      </button>
      <button
        type="button"
        onClick={async () => showToast((await verifyCopy.copy(verifyUrl)) ? "Verify URL copied" : "Verify URL copy failed")}
        className={"rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-emerald-400" + copiedRing(verifyCopy.status)}
        title="Copy only the verify endpoint URL for this run"
      >
        {verifyCopy.status === "copied" ? "Copied ✓" : verifyCopy.status === "failed" ? "Copy failed" : "Copy verify URL only"}
      </button>
    </p>
  );
}

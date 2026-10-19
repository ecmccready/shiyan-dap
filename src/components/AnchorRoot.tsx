"use client";

import { useEffect, useState } from "react";
import { useCopy, copiedRing } from "@/lib/use-copy";
import { showToast } from "@/lib/toast";
import { loadExperienceServer, latestVerified } from "@/lib/level4/experience-client";

/**
 * "Anchor root: sha256:<12>…" from GET /api/level4/anchor?run_id=<run>.
 * The root is a prepared Merkle root only; nothing is submitted on-chain
 * (anchored:false). Fails soft: renders nothing without run data or a root.
 */
export default function AnchorRoot({ runId: fixedRunId }: { runId?: string } = {}) {
  const { status: copyStatus, copy } = useCopy();
  const [data, setData] = useState<{ runId: string; root: string; anchored: boolean } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const runId = fixedRunId ?? latestVerified(await loadExperienceServer())?.run_id;
        if (!runId) return;
        const res = await fetch(`/api/level4/anchor?run_id=${encodeURIComponent(runId)}`, { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        if (typeof j?.root !== "string" || !j.root) return;
        setData({ runId, root: j.root, anchored: j.anchored === true });
      } catch {
        /* fail soft */
      }
    })();
  }, [fixedRunId]);

  if (!data) return null;
  const hex = data.root.replace(/^sha256:/, "");
  const href = `/api/level4/anchor?run_id=${encodeURIComponent(data.runId)}`;
  return (
    <p className="text-sm">
      <a href={href} className="underline font-mono text-xs" title={data.root}>
        Anchor root: sha256:{hex.slice(0, 12)}…
      </a>{" "}
      <span className="text-xs text-zinc-500">
        {data.anchored ? "(anchored)" : "(prepared Merkle root; not on-chain, anchored:false)"}
      </span>{" "}
      <button
        type="button"
        onClick={async () => showToast((await copy(data.root)) ? "Anchor root copied" : "Anchor root copy failed")}
        className={"rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-emerald-400" + copiedRing(copyStatus)}
        title="Copy the full anchor root"
      >
        {copyStatus === "copied" ? "Copied ✓" : copyStatus === "failed" ? "Copy failed" : "Copy anchor root"}
      </button>
    </p>
  );
}

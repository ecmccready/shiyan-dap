import Link from "next/link";
import { fmtE, type ExperienceEntry } from "@/lib/level4/experience-client";

/** Latest verified Level 4 result from the durable experience store. */
export default function LatestVerified({
  entry,
  total,
  loading,
}: {
  entry: ExperienceEntry | null;
  total: number;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <section className="rounded-xl border border-zinc-800 p-4 text-sm space-y-2" aria-busy="true">
        <p className="font-medium">Latest verified result</p>
        <p className="text-xs text-zinc-500">Reading the durable experience store…</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 animate-pulse">
          {["Run", "Final e", "Φ vs cold Self()", "Eligible"].map((l) => (
            <div key={l} className="contents">
              <span className="text-zinc-500">{l}</span>
              <span className="h-4 w-24 rounded bg-zinc-800" />
            </div>
          ))}
        </div>
      </section>
    );
  }
  if (!entry) {
    return (
      <section className="rounded-xl border border-zinc-800 p-4 text-sm">
        <p className="font-medium">Verified experience</p>
        <p className="text-zinc-400">
          No verified results recorded.{" "}
          <Link href="/workbench/start" className="underline text-emerald-400">
            Start a run
          </Link>
        </p>
      </section>
    );
  }
  return (
    <section className="rounded-xl border border-emerald-800 p-4 text-sm space-y-2">
      <p className="font-medium">Latest verified result</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
        <dt className="text-zinc-500">Run</dt>
        <dd className="font-mono text-xs break-all">
          <Link href={`/workbench/autonomous?run=${encodeURIComponent(entry.run_id)}`} className="underline">
            {entry.run_id}
          </Link>
        </dd>
        <dt className="text-zinc-500">Final e</dt>
        <dd className="font-mono">{fmtE(entry.e)}</dd>
        {typeof entry.delta_e === "number" && (
          <>
            <dt className="text-zinc-500">Δe (from start)</dt>
            <dd className="font-mono text-emerald-400">
              {fmtE(entry.delta_e)}
              {typeof entry.e0 === "number" ? ` (${fmtE(entry.e0)} → ${fmtE(entry.e)})` : ""}
            </dd>
          </>
        )}
        {typeof entry.phi === "number" && (
          <>
            <dt className="text-zinc-500">Φ vs cold Self()</dt>
            <dd className="font-mono">{fmtE(entry.phi)}</dd>
          </>
        )}
        <dt className="text-zinc-500">Eligible</dt>
        <dd>{entry.eligible ? "yes — goal met" : "no"}</dd>
        <dt className="text-zinc-500">Verified at</dt>
        <dd className="text-xs">{entry.verified_at}</dd>
      </dl>
      <p className="text-xs text-zinc-500">
        {total} verified step{total === 1 ? "" : "s"} in the durable experience store.
      </p>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ExperienceEntry } from "@/lib/level4/experience-client";
import { loadExperienceCached } from "@/lib/domains/experience-cache";
import { useCopy, copiedRing } from "@/lib/use-copy";
import {
  buildListings,
  createLicenseIntent,
  findHighlighted,
  parseReuseParam,
  LICENSE_INTENT_PHI_MIN,
  NO_MONEY_NOTICE,
  type LicenseIntent,
  type MarketplaceListing,
} from "@/lib/marketplace/listings";
import { toLedgerEventShape } from "@/lib/marketplace/ledger-preview";
import { surfaceNote, SURFACE_CAVEAT } from "@/lib/marketplace/error-surface";

const fmt = (n: number | null) => (typeof n === "number" ? n.toFixed(3) : "—");

function IntentPanel({ intent }: { intent: LicenseIntent }) {
  const copy = useCopy(4000, undefined, "license intent");
  const json = JSON.stringify(intent, null, 2);
  const preview = JSON.stringify(toLedgerEventShape(intent), null, 2);
  return (
    <div className="mt-3 rounded-xl border border-zinc-700 p-3" data-license-intent>
      <p className="text-xs text-amber-300 mb-2">{NO_MONEY_NOTICE} Generated in your browser; nothing was sent or stored.</p>
      <pre className="text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap">{json}</pre>
      <button
        type="button"
        onClick={() => void copy.copy(json)}
        className={`mt-2 inline-flex h-8 items-center rounded-full border border-zinc-700 px-3 text-xs text-zinc-200 hover:border-zinc-500${copiedRing(copy.status)}`}
      >
        {copy.status === "copied" ? "Copied ✓" : copy.status === "failed" ? "Copy failed" : "Copy intent JSON"}
      </button>
      <details className="mt-2 text-xs text-zinc-400">
        <summary className="cursor-pointer">Micro-ledger event shape (preview only, not committed)</summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-zinc-300">{preview}</pre>
      </details>
    </div>
  );
}

function Row({ l, highlighted }: { l: MarketplaceListing; highlighted: boolean }) {
  const [intent, setIntent] = useState<LicenseIntent | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const allowed = l.license_intent.allowed;
  return (
    <li
      id={`listing-${l.run_id}`}
      className={`border rounded-2xl p-5 mb-4 text-sm text-zinc-300 ${highlighted ? "border-emerald-500 ring-1 ring-emerald-500" : "border-zinc-800"}`}
      data-listing={l.run_id}
      data-highlighted={highlighted ? "true" : undefined}
    >
      <h3 className="text-base font-semibold text-white mb-2 break-all">{l.run_id}</h3>
      {highlighted && <p className="text-xs text-emerald-300 mb-2" data-reuse-highlight>Selected from the Domains menu (?reuse=). Read-only: nothing is applied until you click Reuse.</p>}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
        <div><dt className="text-zinc-500 text-xs">Plant / domain</dt><dd>{l.domain}</dd></div>
        <div><dt className="text-zinc-500 text-xs">Final e</dt><dd>{fmt(l.final_e)}</dd></div>
        <div><dt className="text-zinc-500 text-xs">Δe (e0 − final e)</dt><dd>{fmt(l.delta_e)}</dd></div>
        <div><dt className="text-zinc-500 text-xs">Φ (cold baseline − final e)</dt><dd>{fmt(l.phi)}</dd></div>
        <div><dt className="text-zinc-500 text-xs">Verified at</dt><dd>{l.verified_at}</dd></div>
        <div><dt className="text-zinc-500 text-xs">Cold baseline e</dt><dd>{fmt(l.baseline_e)}</dd></div>
      </dl>
      <p className="mt-2 text-xs text-zinc-400"><span className="text-zinc-200">Sequence:</span> {l.sequence.join(" → ")}</p>
      <p className="mt-2 text-xs text-zinc-400" data-error-surface title={l.error_surface.axes.map((a) => `${a.axis}: ${a.status} — ${a.note}`).join("\n")}>
        <span className="text-zinc-200">Error surface (stub):</span> <code className="text-zinc-300">{surfaceNote(l.error_surface)}</code>
        <span className="block text-zinc-500">{SURFACE_CAVEAT}</span>
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Link
          href={l.reuse_href}
          className={highlighted
            ? "inline-flex h-9 items-center rounded-full bg-emerald-600 px-5 text-xs font-semibold text-black hover:bg-emerald-500"
            : "inline-flex h-9 items-center rounded-full border border-emerald-600 px-4 text-xs text-emerald-300 hover:border-emerald-400"}
        >
          Reuse
        </Link>
        <button
          type="button"
          disabled={!allowed}
          onClick={() => {
            const r = createLicenseIntent(l, new Date().toISOString());
            if (r.ok) { setIntent(r.intent); setRefusal(null); } else { setIntent(null); setRefusal(r.reason); }
          }}
          className="inline-flex h-9 items-center rounded-full border border-zinc-600 px-4 text-xs text-zinc-200 hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          License intent
        </button>
        <span className="text-xs text-zinc-500">{allowed ? l.license_intent.reason : `Unavailable: ${l.license_intent.reason}`}</span>
      </div>
      {refusal && <p className="mt-2 text-xs text-amber-300">{refusal}</p>}
      {intent && <IntentPanel intent={intent} />}
    </li>
  );
}

/** Shared index of proven actions: the Φ > 0 records the Domains dropdown ranks, one listing per run. Read-only. */
export default function MarketplaceListings() {
  const [entries, setEntries] = useState<ExperienceEntry[] | null>(null);
  useEffect(() => {
    let active = true;
    loadExperienceCached().then((list) => { if (active) setEntries(list); });
    return () => { active = false; };
  }, []);
  const listings = useMemo(() => (entries ? buildListings(entries) : []), [entries]);
  // Optional ?reuse=<run_id> from the Domains menu: highlight that listing (read-only). Read on the client only.
  const search = useSyncExternalStore(
    () => () => {},
    () => window.location.search,
    () => "",
  );
  const reuseId = parseReuseParam(search);
  const highlighted = findHighlighted(listings, reuseId);
  useEffect(() => {
    if (highlighted) document.getElementById(`listing-${highlighted.run_id}`)?.scrollIntoView({ block: "center" });
  }, [highlighted]);
  return (
    <section className="mb-10" aria-labelledby="live-listings">
      <h2 id="live-listings" className="text-xl font-semibold text-white mb-2">Live verified sequences</h2>
      <p className="text-sm text-zinc-400 mb-3">
        Only runs whose final e fell below their recorded cold baseline (Φ &gt; 0), ranked by Φ, from the same experience
        records as the Domains menu. Φ is each run&apos;s own value against its recorded baseline, not an independent cold run,
        and nothing here is third-party attested. Peers can read the same index at{" "}
        <a className="underline" href="/api/marketplace/listings">/api/marketplace/listings</a>.
      </p>
      <p className="text-sm text-zinc-400 mb-3">
        Reuse hands the sequence to the run page, which re-checks permitted actions and replays it against the built-in
        sequence before using it, and falls back with a reason if it fails. Listings are plain action lists with no model-specific fields.
      </p>
      <p className="text-xs text-amber-300 mb-4">
        License intent only records a copyable intent when Φ &gt; {LICENSE_INTENT_PHI_MIN}. {NO_MONEY_NOTICE} No payment,
        settlement or ledger write happens.
      </p>
      <p className="text-xs text-zinc-500 mb-4">
        Each listing carries a display-only error surface: Φ plus the axes already recorded (final e, tensor distance) and
        placeholders for latency, cost and safety, which are not measured yet. Φ is the only ranking key.
      </p>
      {entries !== null && reuseId && !highlighted && (
        <p className="text-xs text-amber-300 mb-4" data-reuse-note>
          <code>{reuseId}</code> is not a verified listing right now (not eligible, not complete, or not in the store). Showing all listings.
        </p>
      )}
      {entries === null ? (
        <p className="text-sm text-zinc-500">Loading verified sequences…</p>
      ) : listings.length === 0 ? (
        <p className="text-sm text-zinc-500">No verified sequence with Φ &gt; 0 is available right now.</p>
      ) : (
        <ul>{listings.map((l) => <Row key={l.run_id} l={l} highlighted={highlighted?.run_id === l.run_id} />)}</ul>
      )}
    </section>
  );
}

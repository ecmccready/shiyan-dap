"use client";

import WhatYouGet from "@/components/WhatYouGet";
import Link from "next/link";
import JourneyNote from "@/components/JourneyNote";
import ExternalConfirmation from "@/components/ExternalConfirmation";
import SiteHeader from "@/components/SiteHeader";

export default function OfferPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
          Solicitation
        </p>
        <h1 className="text-3xl font-bold mb-3">Aethel Node · workbench offer</h1>
        <p className="text-zinc-400 max-w-2xl mb-8">
          Aethel Node proves that the next action is no longer a misdiagnosis. Know which SI (Super Intelligence) workflow works, prove that it works, and reuse it only when the measured evidence supports doing so.
        </p>

        <div className="mb-6"><JourneyNote /></div>

        <section id="pilot-proposition" data-offer-pilot-proposition className="border border-emerald-800 bg-emerald-950/30 rounded-2xl p-5 mb-8 text-sm text-zinc-300">
          <p className="text-emerald-400 text-xs uppercase tracking-widest mb-2">Pilot proposition · Know → Know How → Show → Do</p>
          <ol className="grid sm:grid-cols-4 gap-3 mb-3">
            <li><span className="text-white">Know.</span> Provenance-hashed source data.</li>
            <li><span className="text-white">Know How.</span> Deterministic checks; measured error reduction (Δe, Φ) against a recorded baseline.</li>
            <li><span className="text-white">Show.</span> Source-linked evidence pack with a recomputable hash.</li>
            <li><span className="text-white">Do.</span> Human-in-the-loop dispositions and a tamper-evident hand-off pack.</li>
          </ol>
          <p className="mb-2">
            First concrete case: <Link className="underline text-emerald-400" href="/workbench/medicare">Medicare · Public Data Intelligence</Link> (SI-operated, synthetic fixture today, no live CMS fetch).
          </p>
          <p className="mb-2">
            Second case: <Link className="underline text-emerald-400" href="/workbench/robotics">Long-horizon robotics policies</Link> (synthetic fixture, same four-stage graph and look-back ranking).
          </p>
          <p className="mb-2">
            Persistent-autonomy benchmark: <Link className="underline text-emerald-400" href="/workbench/robotics/benchmark">Long-horizon robotics protocol</Link> (synthetic protocol; measures predicted-vs-actual, intervention rate, and look-back vs greedy).
          </p>
          <p className="mb-2">
            Value summary: <Link className="underline text-emerald-400" href="/workbench/robotics/value">Long-horizon robotics value</Link> (shareable reference for customer acquisition).
          </p>
          <p className="mb-2">
            Experiment runner: <Link className="underline text-emerald-400" href="/workbench/robotics/experiment">Persistent-autonomy experiment</Link> (deterministic simulator, repeated trials, downloadable evidence pack).
          </p>
          <p className="mb-2 text-xs text-zinc-400">
            A reviewer can open the experiment, change seeds, run look-back versus greedy, download a content-hashed pack, and paste it back to verify the hash. Synthetic fixture today. Real robot control remains outside the engine.
          </p>
          <p className="text-zinc-500 text-xs">
            Detected pattern ≠ verified conclusion: findings are inputs for human review, not fraud, misconduct or clinical findings. Commercial licensing available from the owner. Display only; nothing is sent or stored.
          </p>
        </section>

        <section id="evidence-packs" data-offer-evidence-packs className="border border-zinc-800 rounded-2xl p-5 mb-8 text-sm text-zinc-300">
          <p className="text-emerald-400 text-xs uppercase tracking-widest mb-2">Evidence packs a reviewer can copy today</p>
          <p data-offer-audit-link className="text-zinc-400 text-xs mb-2">Want the whole inventory in one place? <Link className="underline text-cyan-300" href="/workbench/audit">See the audit summary →</Link> (read-only).</p>
          <p data-offer-assets-link className="text-zinc-400 text-xs mb-2">Need the Phase 3 asset map? <Link className="underline text-cyan-300" href="/workbench/assets">See the asset map →</Link> (read-only).</p>
          <p data-offer-compliance-link className="text-zinc-400 text-xs mb-2">Need Phase 3 diagnostics compliance? <Link className="underline text-cyan-300" href="/workbench/compliance">See compliance →</Link> (read-only).</p>
          <div className="grid sm:grid-cols-2 gap-4 mb-3">
            <div>
              <p className="text-white mb-1"><Link className="underline" href="/workbench/medicare">Medicare · HITL review →</Link></p>
              <p>Progress · Statuses · Notes · All rows · Provenance · Baselines · DQ · Hand-off · Case brief</p>
            </div>
            <div>
              <p className="text-white mb-1"><Link className="underline" href="/workbench/status">Look-back · ROE insight →</Link></p>
              <p>Verdict · Gaps · Roles · All paths · All steps · Compare · Summary</p>
            </div>
          </div>
          <p data-offer-strip-ux className="text-zinc-400 text-xs mb-2">
            <span className="text-white">Uncluttered strips:</span> both sticky strips fold secondary chips under Packs ▾ / Jumps ▾ (keys [ / ]), remember open state, filters and focus for this tab, and ↺ Reset view (key 0) restores defaults. View flow: ⧉ View (key -) copies a local view snapshot JSON (strip, filter, focus) → ⇩ Apply view (key +) restores it from the clipboard → ↺ Reset view (key 0) returns to defaults. Snapshots also embed the shareable page view_url (look-back lb_* on /workbench/status / Medicare m_* incl. m_target on /workbench/medicare; omitted unless http(s)), so a pasted ⧉ View doubles as an openable link — while ⇩ Apply view still restores from the snapshot fields, not the URL. Restore is schema-gated: look-back accepts only aethel.roe_lookback.view.v1 and Medicare only aethel.medicare.view.v1, so each rejects the other's snapshot with a ⚠ toast. Share flow: sticky ⧉ Link (key {"\\"}) copies a shareable page URL with view params (look-back lb_show / lb_sort / lb_packs / lb_jumps plus lb_focus (focused path) / lb_expand (expand-all) on /workbench/status; Medicare m_filter / m_packs / m_jumps plus m_target (key target) on /workbench/medicare) — opening it restores that view. Got a link instead of JSON? Sticky ⇩ Apply link restores a view from a pasted shareable page URL (look-back lb_* / Medicare m_*) without reloading — distinct from ⇩ Apply view, which takes the JSON snapshot; a wrong page or a link with no view params gets a ⚠ toast and changes nothing. Packs carry the link too: Medicare 📦 Hand-off and look-back ⚖ Compare packs now include a shareable view_url (same link as ⧉ Link), so a reviewer opens the exact view behind the evidence. Same for every pack copy: Medicare Know-trail copies (⧉ Provenance, ⧉ Baselines, ⧉ DQ, ⧉ Evidence, ⧉ Investigation) and look-back pack copies (⧉ Summary, ⧉ Verdict, ⧉ Gaps, ⧉ Roles, ⧉ All paths / All steps, ⚖ Compare) carry the same optional view_url (omitted unless http(s)) — clipboard only. Pack view_urls also carry the reviewer's focus, matching ⧉ Link: look-back links include lb_focus (+ lb_expand) and Medicare links include m_target, so the recipient lands on the same row/path — clipboard/URL only. Keys at a glance: - View · + Apply · 0 Reset · {"\\"} Link. Audit key: look-back and Medicare share backtick {"`"} → Audit summary (<Link href="/workbench/audit" className="underline text-cyan-300">/workbench/audit</Link>, read-only) — same key on both surfaces; navigation only. Asset map keys: look-back . → Asset map and Medicare = → Asset map (<Link href="/workbench/assets" className="underline text-cyan-300">/workbench/assets</Link>, read-only) — keys differ because Medicare already uses . (⧉ Provenance) and / ; navigation only. Compliance keys: look-back , → Compliance and Medicare &lt; → Compliance (<Link href="/workbench/compliance" className="underline text-cyan-300">/workbench/compliance</Link>, read-only) — keys differ because Medicare , copies ⧉ Baselines; navigation only. Recent toasts filter: look-back Recent has All / Win / Agree / Empty tone chips and Medicare Recent has All / Done / Empty; the panel ⧉ Copy all and the sticky ⧉ Copy recent (key p) copy only the filtered set — clipboard only. Shareable view URLs carry the tone filter too: look-back lb_tone=win|agree|empty and Medicare m_tone=done|empty (missing = All), so a ⧉ Link opens with the same Recent filter — URL only. ⧉ View snapshots (look-back + Medicare) also embed a first-class recentTone field, so ⇩ Apply view restores the Recent filter without parsing view_url; older snapshots without it still fall back to lb_tone / m_tone in their view_url — clipboard only. Keys: look-back &apos; and Medicare : cycle the Recent tone filter (keys differ because Medicare &apos; / &quot; copy disposition rows). Divergence ⑂: look-back shows ⑂ first path split — the first step where look-back and greedy diverge (sticky ⑂ chip click jumps to that step then copies; Shift+D copies only; also in the ⚖ Compare pack) — and Medicare shows ⑂ first disposition off unreviewed — the first row whose disposition differs from the default (sticky ⑂ chip click jumps/focuses that row then copies; Shift+D copies only; also in the 📦 Hand-off pack); clipboard only. Payoff ↺: look-back ↺ shows when look-back catches greedy again after the ⑂ split (sticky ↺ chip click jumps to that step then copies; Shift+P copies only; also in the ⚖ Compare pack) and Medicare ↺ shows review recovery after the first divergence (sticky ↺ chip click jumps/focuses the recovery row then copies; Shift+P copies only; also in the 📦 Hand-off pack); clipboard only. sessionStorage + URL + clipboard only; no server writes. <span className="text-white">Peer-visible:</span> Known peers and Copy capabilities JSON on <Link href="/workbench/marketplace" className="underline text-cyan-300">/workbench/marketplace</Link> now advertise shareable look-back (lb_*) and Medicare (m_*) view surfaces plus all 21 clipboard evidence packs that carry view_url (divergence ⑂ and payoff ↺ in look-back compare + Medicare hand-off, payoff also inside the ⑂ divergence copy; Medicare handoff, dispositions, case_brief, progress, statuses, notes, all_rows, investigation, evidence, provenance, baselines, dq; look-back compare, summary, verdict, gaps, roles, all_paths, all_steps) — the marketplace row shows the count, so buyers see exactly what a node can hand over, each pack linked to its view, before asking. Soft-compat: older peers may omit the view fields or advertise a shorter pack list (warning, not a failure). Audit too: Known peers and Copy view surfaces JSON now also advertise audit_summary_path (<Link href="/workbench/audit" className="underline text-cyan-300">/workbench/audit</Link>, read-only Phase 3 audit summary), so a buyer can jump straight to a node's audit page; older peers that omit it just get a soft-compat warning, never a failure. Asset map too: peers now also advertise asset_map_path (<Link href="/workbench/assets" className="underline text-cyan-300">/workbench/assets</Link>, read-only Phase 3 asset map) alongside audit_summary_path, so a buyer can open a node's asset map directly; omitting it is soft-compat (warning only). Compliance too: peers now also advertise compliance_path (<Link href="/workbench/compliance" className="underline text-cyan-300">/workbench/compliance</Link>, read-only Phase 3 Diagnostics Compliance) next to audit_summary_path and asset_map_path, so a buyer can open a node's compliance page directly; omitting it is soft-compat (warning only).
          </p>
          <p className="text-zinc-500 text-xs">
            One click each from the sticky strips; JSON goes to the local clipboard only. Synthetic Medicare fixture, no live CMS fetch. Detected pattern ≠ verified conclusion. Display only; nothing is sent or stored.
          </p>
        </section>

        <section className="border border-zinc-800 rounded-2xl p-5 mb-8 text-sm text-zinc-300 space-y-3">
          <p><span className="text-white">Buyer:</span> Organization responsible for the quality, cost, or reliability of repeated workflows.</p>
          <p><span className="text-white">Product:</span> Workbench that executes tasks, scores outcomes against a reference, and records reproducible evidence.</p>
          <p><span className="text-white">Primary metric:</span> Change in final error, Φ, alongside task success, cost, latency, and safety.</p>
          <p><span className="text-white">Business model:</span> Subscription for the workbench, usage-based execution, later paid access to verified reusable workflows.</p>
        </section>

        <div className="mb-8"><ExternalConfirmation /></div>

        <h2 className="text-xl font-semibold mb-3">Public proof</h2>
        <p className="text-zinc-400 text-sm mb-4">
          Sealed reference packs on the plant. Every step is gated, measured for error e, and recorded. Φ only when final e falls.
        </p>
        <nav className="flex flex-wrap gap-4 text-sm mb-8">
          <Link className="underline" href="/workbench/shiyan">Shiyan + Model 3 proof</Link>
          <Link className="underline" href="/workbench/proof">Safety proof</Link>
        </nav>

        <h2 className="text-xl font-semibold mb-3">Client pipeline</h2>
        <p className="text-zinc-400 text-sm mb-4">
          Same workbench. Client supplies the repeated workflow and the objective reference. Export stores an inspectable Run.
        </p>
        <nav className="flex flex-wrap gap-4 text-sm mb-8">
          <Link className="underline" href="/workbench/client">Client pipeline</Link>
          <Link className="underline font-medium text-emerald-400" href="/workbench/pilot">Request a pilot →</Link>
          <Link className="underline" href="/workbench/history">History</Link>
        </nav>
        <p className="text-xs text-zinc-500 -mt-6 mb-8">
          Pilot pricing: set per pilot against the measured Φ; no charge on ties or regressions. Check the evidence first on{" "}
          <Link className="underline" href="/workbench/status">status</Link>.
        </p>

        <div className="mb-8"><WhatYouGet /></div>

        <h2 className="text-xl font-semibold mb-3">Verified sequences</h2>
        <p className="text-zinc-400 text-sm mb-4">
          Listings of sequences that have already lowered final e. Not settled. Not revenue.
        </p>
        <nav className="flex flex-wrap gap-4 text-sm mb-8">
          <Link className="underline" href="/workbench/marketplace">Marketplace</Link>
        </nav>

        <h2 className="text-xl font-semibold mb-3">Enterprise surfaces</h2>
        <p className="text-zinc-400 text-sm mb-4">
          Read-only views of the off-chain micro-ledger, live today: an asset map (each asset&apos;s creation domain, latest domain, latest audit status and event timeline) and an audit summary (event counts by domain, signature status and settlement rail, assets with a passed audit, and the current Merkle root, which is not anchored on-chain). Audit results come from a heuristic mock scan, not a third-party attestation. Nothing here is settled or revenue.
        </p>
      </main>
    </div>
  );
}
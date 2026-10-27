"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { act, connectHost, freshCaseId, httpTransport, reuseOutsideSelf } from "@/lib/mcp/host";
import { saveCold } from "@/lib/cold-record";
import { COLD_NOT_A_WIN_NOTE, COLD_OPT_IN_TEXT, COMMERCIAL_CASE_NOTE, COMMERCIAL_OPT_IN_TEXT, coldSelfOverMcp } from "@/lib/mcp/cold";
import { PLANTS } from "@/product/experience";

type Arm = { id: string; z: string; e: string; phi: string; verdict: string };

export default function ComparePage() {
  const [arms, setArms] = useState<Arm[]>([]);
  const [note, setNote] = useState("Not run. A does not change. Identity is not a measurement.");
  const [busy, setBusy] = useState(false);
  const [useCold, setUseCold] = useState(false);
  const [useCommercial, setUseCommercial] = useState(false);

  async function prove() {
    setBusy(true);
    try {
      const next: Arm[] = [];
      for (const plant of PLANTS) {
        const rpc = httpTransport(plant.href);
        await connectHost(rpc);
        const commercial = useCold && useCommercial && plant.id === "B1";
        const caseId = freshCaseId(commercial ? "commercial" : plant.id);
        if (useCold && plant.id === "B1") {
          const run = await coldSelfOverMcp(rpc, caseId);
          const reuse = await reuseOutsideSelf(rpc, run.coldFinalE, caseId);
          saveCold({ plant: commercial ? "commercial" : "default", page: "/workbench/compare", case_id: caseId, start_e: Number(run.e0), cold_final_e: Number(run.coldFinalE), cold_sequence: run.sequence, sealed_final_e: Number(reuse.final_e), phi: Number(reuse.phi) });
          next.push({
            id: plant.id,
            z: String(reuse.z ?? "none"),
            e: `${run.e0} → ${run.coldFinalE} cold Self() (${run.sequence.join(" → ") || "no step lowered e"}) · ${reuse.final_e} sealed sequence`,
            phi: String(reuse.phi),
            verdict: reuse.better ? `error win vs the greedy cold run${commercial ? " on the MCP commercial case" : ""} (reuse final e strictly below cold final e)` : "not a win: reuse final e is not strictly below the cold final e",
          });
          continue;
        }
        const cold = await act(rpc, "mark_boundary", caseId);
        const coldFinal = cold?.e_next ?? cold?.e ?? 0;
        const reuse = await reuseOutsideSelf(rpc, coldFinal, caseId);
        next.push({
          id: plant.id,
          z: String(reuse.z ?? cold?.z ?? "none"),
          e: `${cold?.e ?? "?"} → ${coldFinal} mark_boundary baseline · ${reuse.final_e} sealed sequence`,
          phi: String(reuse.phi),
          verdict: reuse.better ? "improvement vs mark_boundary baseline, not a cold-run win" : "no improvement vs mark_boundary baseline",
        });
      }
      setArms(next);
      const lost = useCold && !useCommercial && next.some((a) => a.id === "B1" && a.verdict.startsWith("not a win"));
      setNote(
        (useCold
          ? "Same A. No plant import. B1: Φ is the cold Self() final e minus the sealed-sequence final e, an error win only when strictly positive. That cold run is a greedy one-step-lookahead controller over MCP, not the Safety-proof Self(). B2: no cold Self() exists (fixed fixture), so its Φ is the drop from the mark_boundary baseline and is not a cold-run win."
          : "Same A. No plant import. Outputs are comparable because both printed z and e. Φ here is the drop from the mark_boundary baseline (which does not change e) to the sealed-sequence final e. Each run uses a fresh case, so earlier runs do not change the baseline. It is not a cold-run comparison, so it is not an error win. B2 beating B1 is not an error win either."
      ) + (lost ? " " + COLD_NOT_A_WIN_NOTE : "") + (useCold && useCommercial ? " " + COMMERCIAL_CASE_NOTE : ""));
    } catch (err) {
      setArms([]);
      setNote(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench" />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <p className="text-emerald-400 text-xs uppercase tracking-widest">Peer proof</p>
        <h1 className="text-3xl font-bold">Same A. B1 and B2.</h1>
        <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-2xl p-5 overflow-auto">{`SAME A / Self()
     ________|________
     v               v
    B1              B2
   z1, e1          z2, e2
     \\_______________/
             v
        EXPERIENCE
        per plant`}</pre>
        <p className="text-zinc-400">A does not change. One controller. Two independently addressed Workbenches. Same measurement contract.</p>
        <label className="flex items-start gap-3 text-sm text-zinc-300">
          <input type="checkbox" className="mt-1" checked={useCold} disabled={busy} onChange={(e) => setUseCold(e.target.checked)} />
          <span>{COLD_OPT_IN_TEXT}</span>
        </label>
        <label className="flex items-start gap-3 text-sm text-zinc-300">
          <input type="checkbox" data-commercial-case className="mt-1" checked={useCommercial} disabled={busy || !useCold} onChange={(e) => setUseCommercial(e.target.checked)} />
          <span>{COMMERCIAL_OPT_IN_TEXT}</span>
        </label>
        <button disabled={busy} onClick={prove} className="h-11 px-5 rounded-full bg-emerald-600 text-sm">
          Print z and e on both
        </button>
        <div className="grid gap-3 md:grid-cols-2">
          {arms.map((arm) => (
            <section key={arm.id} className="border border-zinc-800 rounded-2xl p-5 text-sm">
              <p className="text-emerald-400 text-xs">A → {arm.id}</p>
              <p>z · {arm.z}</p>
              <p>e · {arm.e}</p>
              <p>Φ · {arm.phi} · {arm.verdict}</p>
            </section>
          ))}
        </div>
        <p className="text-zinc-500 text-sm">{note} Safety rows stay on /workbench/proof. No settled payment.</p>
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/workbench/repeat">Repeat the sequence</Link>
          <Link className="underline" href="/api/b2">B2 identity</Link>
        </nav>
      </main>
    </div>
  );
}
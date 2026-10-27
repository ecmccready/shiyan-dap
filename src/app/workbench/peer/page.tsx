"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { act, connectHost, freshCaseId, httpTransport, reuseOutsideSelf } from "@/lib/mcp/host";
import { saveCold } from "@/lib/cold-record";
import { COLD_NOT_A_WIN_NOTE, COLD_OPT_IN_TEXT, coldSelfOverMcp } from "@/lib/mcp/cold";

type Arm = { name: string; z: string; e: string; phi: string; verdict: string };

export default function PeerPage() {
  const [arms, setArms] = useState<Arm[]>([]);
  const [note, setNote] = useState("Not run.");
  const [busy, setBusy] = useState(false);
  const [useCold, setUseCold] = useState(false);

  async function prove() {
    setBusy(true);
    try {
      const plants = [
        { name: "B1", url: "/api/mcp" },
        { name: "B2", url: "/api/mcp/independent" },
      ];
      const next: Arm[] = [];
      for (const plant of plants) {
        const rpc = httpTransport(plant.url);
        await connectHost(rpc);
        const caseId = freshCaseId(plant.name);
        if (useCold && plant.name === "B1") {
          const run = await coldSelfOverMcp(rpc);
          const reuse = await reuseOutsideSelf(rpc, run.coldFinalE, caseId);
          saveCold({ page: "/workbench/peer", case_id: caseId, start_e: Number(run.e0), cold_final_e: Number(run.coldFinalE), cold_sequence: run.sequence, sealed_final_e: Number(reuse.final_e), phi: Number(reuse.phi) });
          next.push({
            name: plant.name,
            z: String(reuse.z ?? "none"),
            e: `${run.e0} → ${run.coldFinalE} cold Self() (${run.sequence.join(" → ") || "no step lowered e"}) · ${reuse.final_e} sealed sequence`,
            phi: String(reuse.phi),
            verdict: reuse.better ? "error win vs the cold Self() run (reuse final e strictly below cold final e)" : "not a win: reuse final e is not strictly below the cold final e",
          });
          continue;
        }
        const cold = await act(rpc, "observe", caseId);
        const coldFinal = cold?.e_next ?? 0;
        const reuse = await reuseOutsideSelf(rpc, coldFinal, caseId);
        next.push({
          name: plant.name,
          z: String(reuse.z ?? cold?.z ?? "none"),
          e: `${cold?.e ?? "?"} → ${coldFinal} observe baseline · ${reuse.final_e} sealed sequence`,
          phi: String(reuse.phi),
          verdict: reuse.better ? "improvement vs observe baseline, not a cold-run win" : "no improvement vs observe baseline",
        });
      }
      setArms(next);
      const lost = useCold && next.some((a) => a.name === "B1" && a.verdict.startsWith("not a win"));
      setNote(
        (useCold
          ? "Same host. A was not modified. B1: Φ is the cold Self() final e minus the sealed-sequence final e, so it counts as an error win only when strictly positive. That cold run is a greedy one-step-lookahead controller over MCP, not the Safety-proof Self(). B2: no cold Self() exists (fixed fixture), so its Φ is the drop from the observe baseline and is not a cold-run win."
          : "Same host. A was not modified. Φ here is the drop from the observe baseline to the sealed-sequence final e, per plant. Each run uses a fresh case, so earlier runs do not change the baseline. It is not a cold-run comparison, so it is not an error win."
      ) + (lost ? " " + COLD_NOT_A_WIN_NOTE : ""));
    } catch (err) {
      setNote(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench" />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <p className="text-emerald-400 text-xs uppercase tracking-widest">Peer proof · extremely small</p>
        <h1 className="text-3xl font-bold">Same controller, two workbenches</h1>
        <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-2xl p-5 overflow-auto">{`A / Self()
    │  same controller
    ▼
   MCP
  ┌┴────┐
  ▼     ▼
  B1    B2
  │     │
 z1,e1 z2,e2
  └──┬──┘
     ▼
 Φ / experience`}</pre>
        <label className="flex items-start gap-3 text-sm text-zinc-300">
          <input type="checkbox" className="mt-1" checked={useCold} disabled={busy} onChange={(e) => setUseCold(e.target.checked)} />
          <span>{COLD_OPT_IN_TEXT}</span>
        </label>
        <button disabled={busy} onClick={prove} className="h-11 px-5 rounded-full bg-emerald-600 text-sm">Prove the peer</button>
        {arms.map((arm) => (
          <section key={arm.name} className="border border-zinc-800 rounded-2xl p-5 text-sm">
            <p className="text-emerald-400 text-xs">{arm.name}</p>
            <p>z {arm.z}</p>
            <p>e {arm.e}</p>
            <p>Φ {arm.phi} · {arm.verdict}</p>
          </section>
        ))}
        <p className="text-zinc-500 text-sm">{note} An error win needs a real cold run (see the sealed sequence rule: final e is the win, a tie is not a win). Safety Φ stays on /workbench/proof. No settled payment.</p>
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/workbench/mcp">B1 MCP</Link>
          <Link className="underline" href="/api/mcp/independent">B2 identity</Link>
          <Link className="underline" href="/workbench/proof">Safety proof</Link>
        </nav>
      </main>
    </div>
  );
}
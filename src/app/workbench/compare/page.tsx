"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { act, connectHost, httpTransport, reuseOutsideSelf } from "@/lib/mcp/host";
import { PLANTS } from "@/product/experience";

type Arm = { id: string; z: string; e: string; phi: string; better: boolean };

export default function ComparePage() {
  const [arms, setArms] = useState<Arm[]>([]);
  const [note, setNote] = useState("Not run. A does not change. Identity is not a measurement.");
  const [busy, setBusy] = useState(false);

  async function prove() {
    setBusy(true);
    try {
      const next: Arm[] = [];
      for (const plant of PLANTS) {
        const rpc = httpTransport(plant.href);
        await connectHost(rpc);
        const cold = await act(rpc, "mark_boundary", plant.id);
        const coldFinal = cold?.e_next ?? cold?.e ?? 0;
        const reuse = await reuseOutsideSelf(rpc, coldFinal, plant.id);
        next.push({
          id: plant.id,
          z: String(reuse.z ?? cold?.z ?? "none"),
          e: `${cold?.e ?? "?"} → ${coldFinal} cold · ${reuse.final_e} reuse`,
          phi: String(reuse.phi),
          better: Boolean(reuse.better),
        });
      }
      setArms(next);
      setNote("Same A. No plant import. Outputs are comparable because both printed z and e. B2 beating B1 is not an error win.");
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
        <button disabled={busy} onClick={prove} className="h-11 px-5 rounded-full bg-emerald-600 text-sm">
          Print z and e on both
        </button>
        <div className="grid gap-3 md:grid-cols-2">
          {arms.map((arm) => (
            <section key={arm.id} className="border border-zinc-800 rounded-2xl p-5 text-sm">
              <p className="text-emerald-400 text-xs">A → {arm.id}</p>
              <p>z · {arm.z}</p>
              <p>e · {arm.e}</p>
              <p>Φ · {arm.phi} · {arm.better ? "error win on this plant" : "not a win"}</p>
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
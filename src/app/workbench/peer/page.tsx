"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { act, connectHost, httpTransport, reuseOutsideSelf } from "@/lib/mcp/host";

type Arm = { name: string; z: string; e: string; phi: string; better: boolean };

export default function PeerPage() {
  const [arms, setArms] = useState<Arm[]>([]);
  const [note, setNote] = useState("Not run.");
  const [busy, setBusy] = useState(false);

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
        const cold = await act(rpc, "observe", plant.name);
        const coldFinal = cold?.e_next ?? 0;
        const reuse = await reuseOutsideSelf(rpc, coldFinal, plant.name);
        next.push({
          name: plant.name,
          z: String(reuse.z ?? cold?.z ?? "none"),
          e: `${cold?.e ?? "?"} → ${coldFinal} cold · ${reuse.final_e} reuse`,
          phi: String(reuse.phi),
          better: Boolean(reuse.better),
        });
      }
      setArms(next);
      setNote("Same host. A was not modified. Φ is per plant. B2 beating B1 is not an error win.");
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
        <button disabled={busy} onClick={prove} className="h-11 px-5 rounded-full bg-emerald-600 text-sm">Prove the peer</button>
        {arms.map((arm) => (
          <section key={arm.name} className="border border-zinc-800 rounded-2xl p-5 text-sm">
            <p className="text-emerald-400 text-xs">{arm.name}</p>
            <p>z {arm.z}</p>
            <p>e {arm.e}</p>
            <p>Φ {arm.phi} · {arm.better ? "error win on this plant" : "not a win"}</p>
          </section>
        ))}
        <p className="text-zinc-500 text-sm">{note} A tie is not a win. Safety Φ stays on /workbench/proof. No settled payment.</p>
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/workbench/mcp">B1 MCP</Link>
          <Link className="underline" href="/api/mcp/independent">B2 identity</Link>
          <Link className="underline" href="/workbench/proof">Safety proof</Link>
        </nav>
      </main>
    </div>
  );
}
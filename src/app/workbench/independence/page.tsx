"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { act, connectHost, httpTransport, reuseOutsideSelf } from "@/lib/mcp/host";
import { PLANTS } from "@/product/experience";

type Arm = { id: string; tools: string; z: string; e: string; phi: string; better: boolean };

export default function IndependencePage() {
  const [arms, setArms] = useState<Arm[]>([]);
  const [note, setNote] = useState("Not run. A B2 identity is not a measurement.");
  const [busy, setBusy] = useState(false);

  async function prove() {
    setBusy(true);
    try {
      const next: Arm[] = [];
      for (const plant of PLANTS) {
        const rpc = httpTransport(plant.href);
        const host = await connectHost(rpc);
        const listed = Array.isArray(host.tools)
          ? host.tools
          : ((host.tools as { tools?: { name: string }[] })?.tools ?? []);
        const cold = await act(rpc, "mark_boundary", plant.id);
        const coldFinal = cold?.e_next ?? cold?.e ?? 0;
        const reuse = await reuseOutsideSelf(rpc, coldFinal, plant.id);
        next.push({
          id: plant.id,
          tools: listed.map((tool) => tool.name).join(", ") || "none listed",
          z: String(reuse.z ?? cold?.z ?? "none"),
          e: `${cold?.e ?? "?"} → ${coldFinal} cold · ${reuse.final_e} reuse`,
          phi: String(reuse.phi),
          better: Boolean(reuse.better),
        });
      }
      setArms(next);
      setNote("Same A. No plant import. Φ stays inside the plant that printed it. B2 beating B1 is not an error win.");
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
        <p className="text-emerald-400 text-xs uppercase tracking-widest">Now prove</p>
        <h1 className="text-3xl font-bold">A → B1 and A → B2</h1>
        <p className="text-zinc-400">
          B2 is a separate server. The same A operates both without knowing their internal implementation.
        </p>
        <blockquote className="border-l-2 border-zinc-700 pl-4 text-zinc-200">
          The same A can operate different Workbenches without knowing their internal implementation.
        </blockquote>
        <ul className="text-sm text-zinc-400 space-y-1">
          {PLANTS.map((plant) => (
            <li key={plant.id}>{plant.id} · {plant.href} · {plant.note}</li>
          ))}
        </ul>
        <button disabled={busy} onClick={prove} className="h-11 px-5 rounded-full bg-emerald-600 text-sm">
          Print z and e on both
        </button>
        {arms.map((arm) => (
          <section key={arm.id} className="border border-zinc-800 rounded-2xl p-5 text-sm">
            <p className="text-emerald-400 text-xs">A → {arm.id}</p>
            <p>tools seen by A · {arm.tools}</p>
            <p>z · {arm.z}</p>
            <p>e · {arm.e}</p>
            <p>Φ · {arm.phi} · {arm.better ? "error win on this plant" : "not a win"}</p>
          </section>
        ))}
        <p className="text-zinc-500 text-sm">{note} Safety rows stay on /workbench/proof. No settled payment.</p>
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/workbench/watch">Watched Run</Link>
          <Link className="underline" href="/workbench/peer">Peer</Link>
          <Link className="underline" href="/api/b2">B2 identity</Link>
        </nav>
      </main>
    </div>
  );
}
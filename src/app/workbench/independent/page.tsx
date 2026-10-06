use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { act, connectHost, httpTransport, reuseOutsideSelf } from "@/lib/mcp/host";

type Row = { label: string; value: string };

export default function IndependentBPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const rpc = httpTransport("/api/mcp/independent");

  async function prove() {
    setBusy(true);
    try {
      const host = await connectHost(rpc);
      const cold = await act(rpc, "observe", "partner-fixture-b");
      const coldFinal = cold?.e_next ?? 0;
      const reuse = await reuseOutsideSelf(rpc, coldFinal, "partner-fixture-b");
      setRows([
        { label: "same A", value: "aethel-controller-a via JSON-RPC. This page does not import the plant." },
        { label: "independent B", value: "partner-fixture-b · POST /api/mcp/independent" },
        { label: "tools", value: JSON.stringify(host.tools, null, 2) },
        { label: "cold z / e / Δe", value: `z ${cold?.z} · e ${cold?.e} → ${cold?.e_next} · Δe ${cold?.delta_e}` },
        { label: "reuse z / e / Δe", value: `z ${reuse.z} · final e ${reuse.final_e} · Δe ${reuse.delta_e}` },
        { label: "Φ", value: `${reuse.phi} · ${reuse.better ? "error win on this B" : "not a win"}` },
      ]);
    } catch (err) {
      setRows([{ label: "not proved", value: String(err) }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench" />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <p className="text-emerald-400 text-xs uppercase tracking-widest">Same A · other B</p>
        <h1 className="text-3xl font-bold">Independent Workbench B</h1>
        <p className="text-zinc-400">
          Connect a genuinely independent Workbench B to Aethel Node through MCP and prove that the same A can produce measurable z / e / Δe there. A is not rewritten. Self() does not read prior Runs. This plant is not the Safety proof.
        </p>
        <button disabled={busy} onClick={prove} className="h-11 px-5 rounded-full bg-emerald-600 text-sm">
          Measure this B
        </button>
        {rows.map((r) => (
          <pre key={r.label} className="text-xs bg-zinc-950 border border-zinc-800 rounded-2xl p-5 overflow-auto">
            {r.label}{"\n"}{r.value}
          </pre>
        ))}
        <p className="text-zinc-500 text-sm">A tie is not a win. The Safety Φ values are not this plant. No settled payment.</p>
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/workbench/mcp">MCP</Link>
          <Link className="underline" href="/workbench/proof">Safety proof</Link>
          <Link className="underline" href="/api/mcp/independent">B identity</Link>
        </nav>
      </main>
    </div>
  );
}
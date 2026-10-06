"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { RECORDED_PACKS, SEALED_SEQUENCE } from "@/lib/mcp/schema";
import { act, connectHost, httpTransport, reuseOutsideSelf } from "@/lib/mcp/host";

type Row = { label: string; value: string };

export default function McpPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const rpc = httpTransport("/api/mcp");

  async function run(label: string, job: () => Promise<unknown>) {
    setBusy(true);
    try {
      const value = await job();
      setRows((prev) => [{ label, value: JSON.stringify(value, null, 2) }, ...prev].slice(0, 8));
    } catch (err) {
      setRows((prev) => [{ label, value: String(err) }, ...prev]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">aethel.loop.v1 · Controller A host · Workbench B server</p>
        <h1 className="text-3xl font-bold mb-3">Decoupled protocol loop</h1>
        <p className="text-zinc-400 mb-8">
          Enterprise buyers do not pay for generated text. They pay for a system that takes an action, measures error against a reference, and uses compiled experience to reduce that error. A partner spins up Workbench B. Controller A is not rewritten. Self() still does not read prior Runs.
        </p>

        <section className="bg-zinc-900/60 border border-emerald-800 rounded-2xl p-6 mb-6 font-mono text-sm text-zinc-300">
          <p>CONTROLLER A · MCP host · Memory M · Policy · Self()</p>
          <p className="text-zinc-500 my-2">JSON-RPC · stdio / SSE · POST /api/mcp</p>
          <p>WORKBENCH B · MCP server</p>
          <p className="mt-2">tools · mark_boundary() · seal_pack()</p>
          <p>resources · reference_truth · diagnostic_cases</p>
          <p>output · z · scored e</p>
        </section>

        <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-6">
          <p className="text-xs text-emerald-400 mb-2">Sealed sequence · outside Self()</p>
          <p className="font-mono text-sm">{SEALED_SEQUENCE.join(" → ")}</p>
          <p className="text-zinc-500 text-sm mt-2">The mark does not change e. The seal is the drop. A tie on final e is not a win.</p>
        </section>

        <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-6">
          <p className="text-xs text-emerald-400 mb-4">Recorded packs · 2026-10-03 · cbb3391e</p>
          {RECORDED_PACKS.map((p) => (
            <div key={p.id} className="mb-4">
              <p>{p.label}</p>
              <p className="text-zinc-500 text-sm">cold final {p.cold_final_e} · reuse {p.reuse_final_e} · Φ {p.phi} · better yes</p>
            </div>
          ))}
          <p className="text-zinc-500 text-sm">These rows are the record. A live tool call is a new plant. It does not replace them. No settled payment.</p>
        </section>

        <div className="flex flex-wrap gap-3 mb-8">
          <button disabled={busy} onClick={() => run("initialize", () => connectHost(rpc))} className="h-11 px-6 rounded-full bg-emerald-600 text-sm">
            Connect host
          </button>
          <button disabled={busy} onClick={() => run("mark_boundary", () => act(rpc, "mark_boundary"))} className="h-11 px-6 rounded-full border border-zinc-700 text-sm">
            mark_boundary
          </button>
          <button disabled={busy} onClick={() => run("seal_pack", () => act(rpc, "seal_pack"))} className="h-11 px-6 rounded-full border border-zinc-700 text-sm">
            seal_pack
          </button>
          <button disabled={busy} onClick={() => run("reuse outside Self()", () => reuseOutsideSelf(rpc, 0.165))} className="h-11 px-6 rounded-full border border-zinc-700 text-sm">
            Reuse vs 0.165
          </button>
          <Link href="/workbench" className="h-11 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center">
            Back to B
          </Link>
          <Link href="/workbench/independent" className="h-11 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center">
            Independent B
          </Link>
        </div>

        {rows.map((r) => (
          <pre key={r.label + r.value.slice(0, 24)} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-4 text-xs text-zinc-300 overflow-auto">
            {r.label}{"\n"}{r.value}
          </pre>
        ))}
      </main>
    </div>
  );
}
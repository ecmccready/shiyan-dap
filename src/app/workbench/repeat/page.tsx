"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { act, connectHost, httpTransport, reuseOutsideSelf } from "@/lib/mcp/host";

type Pass = { n: number; cold: string; reuse: string; phi: string; better: boolean };

export default function RepeatPage() {
  const [passes, setPasses] = useState<Pass[]>([]);
  const [note, setNote] = useState("Not run. A second pass is the reproducibility test.");
  const [busy, setBusy] = useState(false);

  async function runTwice() {
    setBusy(true);
    try {
      const rpc = httpTransport("/api/mcp");
      await connectHost(rpc);
      const next: Pass[] = [];
      for (const n of [1, 2]) {
        const cold = await act(rpc, "mark_boundary", `repeat-${n}`);
        const coldFinal = cold?.e_next ?? cold?.e ?? 0;
        const reuse = await reuseOutsideSelf(rpc, coldFinal, `repeat-${n}`);
        next.push({
          n,
          cold: String(coldFinal),
          reuse: String(reuse.final_e),
          phi: String(reuse.phi),
          better: Boolean(reuse.better),
        });
      }
      setPasses(next);
      setNote(
        next.every((pass) => pass.better)
          ? "The reduction repeated on this plant. That is the reproducibility test here. It does not replace the Safety rows."
          : "The reduction did not repeat. Do not call this experience reproducible.",
      );
    } catch (err) {
      setPasses([]);
      setNote(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench" />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <p className="text-emerald-400 text-xs uppercase tracking-widest">Reproducible experience</p>
        <h1 className="text-3xl font-bold">Run the sequence a second time.</h1>
        <ol className="text-sm text-zinc-300 space-y-1">
          <li>A acts</li>
          <li>B executes</li>
          <li>z is measured</li>
          <li>e is calculated</li>
          <li>Δe demonstrates improvement</li>
          <li>Φ becomes experience only if final e falls</li>
          <li>experience is reused outside Self()</li>
        </ol>
        <button disabled={busy} onClick={runTwice} className="h-11 px-5 rounded-full bg-emerald-600 text-sm">
          Print both passes
        </button>
        {passes.map((pass) => (
          <section key={pass.n} className="border border-zinc-800 rounded-2xl p-5 text-sm">
            <p className="text-emerald-400 text-xs">Pass {pass.n}</p>
            <p>cold e = {pass.cold}</p>
            <p>reuse e = {pass.reuse}</p>
            <p>Φ = {pass.phi} · {pass.better ? "fell" : "did not fall"}</p>
          </section>
        ))}
        <p className="text-zinc-500 text-sm">{note} Self() does not read prior Runs. No settled payment.</p>
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/workbench/compare">B1 and B2</Link>
          <Link className="underline" href="/workbench/proof">Safety proof</Link>
        </nav>
      </main>
    </div>
  );
}
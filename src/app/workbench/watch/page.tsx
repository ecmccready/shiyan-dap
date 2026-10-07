"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { act, connectHost, httpTransport, reuseOutsideSelf } from "@/lib/mcp/host";
import { CAPABILITIES, EXPERIENCE_FIELDS, FLYWHEEL, WATCHED_STEPS } from "@/product/experience";

type Printed = {
  y: string;
  z: string;
  eBefore: string;
  eAfter: string;
  deltaE: string;
  cold: string;
  reuse: string;
  phi: string;
  better: boolean;
};

export default function WatchPage() {
  const [printed, setPrinted] = useState<Printed | null>(null);
  const [note, setNote] = useState("Not run. Identity is not a measurement.");
  const [busy, setBusy] = useState(false);

  async function watch() {
    setBusy(true);
    try {
      const rpc = httpTransport("/api/mcp");
      await connectHost(rpc);
      const cold = await act(rpc, "mark_boundary", "watch-b1");
      const coldFinal = cold?.e_next ?? cold?.e ?? 0;
      const reuse = await reuseOutsideSelf(rpc, coldFinal, "watch-b1");
      const better = Boolean(reuse.better);
      setPrinted({
        y: "mark_boundary, then sealed sequence outside Self()",
        z: String(reuse.z ?? cold?.z ?? "none"),
        eBefore: String(cold?.e ?? "none"),
        eAfter: String(reuse.final_e),
        deltaE: String(reuse.delta_e),
        cold: String(coldFinal),
        reuse: String(reuse.final_e),
        phi: String(reuse.phi),
        better,
      });
      setNote(
        better
          ? "Final e fell on this plant. That is the only listing test here."
          : "Final e did not fall. Do not call this experience reusable.",
      );
    } catch (err) {
      setPrinted(null);
      setNote(String(err));
    } finally {
      setBusy(false);
    }
  }

  const x = printed?.cold ?? "X";
  const y = printed?.reuse ?? "Y";

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench" />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <p className="text-emerald-400 text-xs uppercase tracking-widest">One Run</p>
        <h1 className="text-3xl font-bold">Watch it from beginning to end.</h1>
        <p className="text-zinc-400">
          Same A. B1 only. Self() does not read prior Runs. Reuse is outside Self().
        </p>
        <ol className="border border-zinc-800 rounded-2xl p-5 text-sm space-y-1">
          {WATCHED_STEPS.map((step) => (
            <li key={step}>→ {step}</li>
          ))}
        </ol>
        <button disabled={busy} onClick={watch} className="h-11 px-5 rounded-full bg-emerald-600 text-sm">
          Run and print
        </button>
        <section className="border border-zinc-800 rounded-2xl p-5 text-sm space-y-2">
          <p>Cold Run: e = {x}</p>
          <p>Reused Experience: e = {y}</p>
          <p>Δe = X − Y = {printed ? printed.phi : "not printed"}</p>
          <p className="text-zinc-500">{note}</p>
        </section>
        <section className="border border-zinc-800 rounded-2xl p-5 text-sm">
          <p className="text-emerald-400 text-xs mb-2">verified experience</p>
          <p className="font-mono text-xs text-zinc-300">
            Experience = ({EXPERIENCE_FIELDS.join(", ")})
          </p>
          {printed ? (
            <ul className="mt-3 space-y-1 text-zinc-400">
              <li>y · {printed.y}</li>
              <li>z · {printed.z}</li>
              <li>e_before · {printed.eBefore}</li>
              <li>e_after · {printed.eAfter}</li>
              <li>Δe · {printed.deltaE}</li>
              <li>context · B1 /api/mcp · watch-b1</li>
              <li>provenance · host did not import the plant</li>
              <li>replayability · {printed.better ? "sequence kept" : "not kept"}</li>
            </ul>
          ) : null}
        </section>
        <section className="border border-zinc-800 rounded-2xl p-5 text-sm">
          <p className="text-emerald-400 text-xs mb-2">Flywheel</p>
          <p>{FLYWHEEL.join(" → ")}</p>
        </section>
        <section className="border border-zinc-800 rounded-2xl p-5 text-sm">
          {CAPABILITIES.map((row) => (
            <p key={row.capability} className="flex justify-between gap-4 py-1 border-b border-zinc-900">
              <span>{row.capability}</span>
              <Link className="underline text-zinc-400" href={row.href}>{row.manifestation}</Link>
            </p>
          ))}
        </section>
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/workbench/independence">A → B1 and A → B2</Link>
          <Link className="underline" href="/workbench/proof">Safety proof</Link>
        </nav>
      </main>
    </div>
  );
}
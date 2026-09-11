"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import RailLinks from "@/components/RailLinks";
import { LedgerAsset, readLedger, readMint } from "@/lib/ledger";

export default function MeasurePage() {
  const [assets, setAssets] = useState<LedgerAsset[]>([]);

  useEffect(() => {
    setAssets(readLedger());
  }, []);

  const settled = assets.filter((a) => a.state === "settled").length;
  const escrow = assets.filter((a) => a.state === "escrow").length;
  const official = assets.filter((a) => a.id === "cl_shiyan_yishu_001" || a.id === "cl_sleep_terrors_001").length;
  const queued = assets.filter((a) => readMint(a.id).status === "queued").length;
  const fit = false;

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Measure" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">Measure</p>
        <h1 className="text-3xl font-bold mb-3">Ledger</h1>
        <p className="text-zinc-400 mb-8">Counts from this browser. Fit stays false until a non-founder live payment.</p>
        <div className="mb-8">
          <RailLinks />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
            <p className="text-xs text-zinc-500 mb-1">Official singles</p>
            <p className="text-2xl font-semibold">{official}</p>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
            <p className="text-xs text-zinc-500 mb-1">Escrow</p>
            <p className="text-2xl font-semibold">{escrow}</p>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
            <p className="text-xs text-zinc-500 mb-1">Settled</p>
            <p className="text-2xl font-semibold">{settled}</p>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
            <p className="text-xs text-zinc-500 mb-1">Mint queued</p>
            <p className="text-2xl font-semibold">{queued}</p>
          </div>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-8">
          <p className="text-xs text-emerald-400 mb-2">Product-market fit</p>
          <p className="text-xl font-semibold mb-2">{fit ? "signaled" : "not yet"}</p>
          <p className="text-sm text-zinc-500">
            Need a live Stripe charge from someone who is not ECMcCready. Sandbox A/B is a signal only.
          </p>
        </div>
        <div className="space-y-3">
          {assets.map((a) => (
            <p key={a.id} className="text-sm text-zinc-400">
              {a.title} · {a.state} · mint {readMint(a.id).status}
            </p>
          ))}
        </div>
      </main>
    </div>
  );
}
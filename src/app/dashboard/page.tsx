"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import RailLinks from "@/components/RailLinks";
import { LedgerAsset, readLedger, wasAcquired } from "@/lib/ledger";

export default function LearnPage() {
  const [assets, setAssets] = useState<LedgerAsset[]>([]);

  useEffect(() => {
    setAssets(
      readLedger().map((a) =>
        wasAcquired(a.id) ? { ...a, buyer: "This session", state: "reserved" } : a
      )
    );
  }, []);

  const reserved = assets.filter((a) => a.state === "reserved").length;
  const next =
    reserved === 0
      ? "Acquire the First Single on /nfts."
      : "Get one paid buyer. Fiat first. Do not wait on-chain.";

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Learn" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">Learn</p>
        <h1 className="text-3xl font-bold mb-3">Next best action</h1>
        <p className="text-zinc-400 mb-8">{next}</p>
        <div className="mb-10">
          <RailLinks />
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-8">
          <p className="text-sm text-zinc-400 mb-2">Founder Model z</p>
          <p className="text-lg">y,x Grok fast + y,x Hy4 deep = z next action</p>
          <p className="text-sm text-zinc-500 mt-3">Memory target: huggingface.co/shiyan-dap</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/nfts" className="h-11 px-6 rounded-full bg-emerald-600 text-white text-sm inline-flex items-center">Prove</Link>
          <Link href="/upload" className="h-11 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center">Upload</Link>
          <Link href="/marketplace" className="h-11 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center">Marketplace</Link>
        </div>
      </main>
    </div>
  );
}
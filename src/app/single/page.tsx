"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { LedgerAsset, readLedger } from "@/lib/ledger";

const KEEP = ["Shiyan Yishu", "Sleep Terrors"];

export default function SongsPage() {
  const [assets, setAssets] = useState<LedgerAsset[]>([]);

  useEffect(() => {
    const all = readLedger();
    setAssets(
      all.filter((a) => KEEP.some((k) => a.title.includes(k))).slice(0, 2)
    );
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Songs" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">Music rail</p>
        <h1 className="text-3xl font-bold mb-8">Songs</h1>

        <div className="space-y-4">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6"
            >
              <h2 className="text-lg font-semibold mb-2">{asset.title}</h2>
              <p className="text-sm text-zinc-500 mb-5">
                id {asset.id} · {asset.state}
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href="http://ecmccready.com/songs"
                  target="_blank"
                  rel="noreferrer"
                  className="h-11 px-6 rounded-full bg-emerald-600 text-sm inline-flex items-center"
                >
                  Play
                </a>
                <Link
                  href="/nfts"
                  className="h-11 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center"
                >
                  Prove
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
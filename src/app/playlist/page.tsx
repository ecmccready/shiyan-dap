"use client";

import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import { LedgerAsset, applyEvent, readLedger } from "@/lib/ledger";

const KEEP = ["Shiyan Yishu", "Sleep Terrors"];

export default function PlaylistPage() {
  const [assets, setAssets] = useState<LedgerAsset[]>([]);

  useEffect(() => {
    const all = readLedger();
    setAssets(
      all.filter((a) => KEEP.some((k) => a.title.includes(k))).slice(0, 2)
    );
  }, []);

  const run = (id: string, event: "EXECUTE_SETTLEMENT" | "ABORT") => {
    applyEvent(id, event);
    const all = readLedger();
    setAssets(
      all.filter((a) => KEEP.some((k) => a.title.includes(k))).slice(0, 2)
    );
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Playlist" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">Music rail</p>
        <h1 className="text-3xl font-bold mb-8">Playlist</h1>

        <div className="space-y-4">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6"
            >
              <h2 className="text-lg font-semibold mb-2">{asset.title}</h2>
              <p className="text-sm text-zinc-500 mb-1">
                Buyer {asset.buyer || "None yet"}
              </p>
              <p className="text-sm text-zinc-500 mb-4">State {asset.state}</p>
              {asset.state === "settled" ? (
                <p className="text-sm text-emerald-400">Settled.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => run(asset.id, "EXECUTE_SETTLEMENT")}
                    className="h-11 px-5 rounded-full bg-emerald-600 text-sm"
                  >
                    Settle
                  </button>
                  <button
                    onClick={() => run(asset.id, "ABORT")}
                    className="h-11 px-5 rounded-full border border-zinc-700 text-sm"
                  >
                    Abort
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
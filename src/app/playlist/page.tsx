"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import RailLinks from "@/components/RailLinks";
import { LedgerAsset, applyEvent, readLedger } from "@/lib/ledger";

export default function PlaylistPage() {
  const [assets, setAssets] = useState<LedgerAsset[]>([]);

  useEffect(() => {
    setAssets(readLedger());
  }, []);

  const run = (id: string, event: "EXECUTE_SETTLEMENT" | "ABORT") => {
    applyEvent(id, event);
    setAssets(readLedger());
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Playlist" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">KNOW HOW</p>
        <h1 className="text-3xl font-bold mb-3">Playlist</h1>
        <p className="text-zinc-400 mb-8">
          Transfer is settlement. Abort returns the asset. Internal P2P only.
        </p>
        <div className="mb-8">
          <RailLinks />
        </div>
        <div className="space-y-4">
          {assets.map((asset) => (
            <div key={asset.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-2">{asset.title}</h2>
              <p className="text-sm text-zinc-500 mb-1">Buyer {asset.buyer}</p>
              <p className="text-sm text-zinc-500 mb-4">State {asset.state}</p>
              {asset.state === "settled" ? (
                <p className="text-sm text-emerald-400">Settled. Open Tokenize to queue a mint.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => run(asset.id, "EXECUTE_SETTLEMENT")}
                    disabled={asset.state !== "escrow"}
                    className="h-11 px-5 rounded-full bg-emerald-600 text-sm disabled:opacity-40"
                  >
                    Settle
                  </button>
                  <button
                    onClick={() => run(asset.id, "ABORT")}
                    disabled={asset.state !== "escrow"}
                    className="h-11 px-5 rounded-full border border-zinc-700 text-sm disabled:opacity-40"
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
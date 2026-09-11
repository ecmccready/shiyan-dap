"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import RailLinks from "@/components/RailLinks";
import { LedgerAsset, MintStandard, queueMint, readLedger, readMint } from "@/lib/ledger";

export default function TokensPage() {
  const [assets, setAssets] = useState<LedgerAsset[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    setAssets(readLedger());
  }, []);

  const queue = (asset: LedgerAsset, standard: MintStandard) => {
    queueMint(asset.id, standard);
    fetch("/api/mint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId: asset.id, title: asset.title, standard }),
    }).catch(() => {});
    setNote(asset.title + " queued as " + standard + ". No chain tx.");
    setAssets(readLedger());
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Protocol" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">Protocol</p>
        <h1 className="text-3xl font-bold mb-3">Tokenize</h1>
        <p className="text-zinc-400 mb-8">
          Mint is an internal queue on top of the P2P machine. Clients do not talk to a chain.
        </p>
        <div className="mb-8">
          <RailLinks />
        </div>
        <div className="space-y-4">
          {assets.map((asset) => {
            const mint = readMint(asset.id);
            return (
              <div key={asset.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
                <h2 className="text-lg font-semibold mb-2">{asset.title}</h2>
                <p className="text-sm text-zinc-500 mb-1">Trade state {asset.state}</p>
                <p className="text-sm text-zinc-500 mb-4">
                  Mint {mint.status} · {mint.standard} · chain none
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => queue(asset, "erc721")}
                    disabled={asset.state !== "settled"}
                    className="h-11 px-5 rounded-full bg-emerald-600 text-sm disabled:opacity-40"
                  >
                    Queue ERC-721
                  </button>
                  <button
                    onClick={() => queue(asset, "erc1155")}
                    disabled={asset.state !== "settled"}
                    className="h-11 px-5 rounded-full border border-zinc-700 text-sm disabled:opacity-40"
                  >
                    Queue ERC-1155
                  </button>
                  <button
                    onClick={() => queue(asset, "spl")}
                    disabled={asset.state !== "settled"}
                    className="h-11 px-5 rounded-full border border-zinc-700 text-sm disabled:opacity-40"
                  >
                    Queue SPL
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {note && <p className="mt-6 text-sm text-emerald-400">{note}</p>}
      </main>
    </div>
  );
}
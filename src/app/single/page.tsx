"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { LedgerAsset, readLedger } from "@/lib/ledger";
import { LoopPlant, readPersistedPlant } from "@/lib/closed-loop";

const KEEP = ["Shiyan Yishu", "Sleep Terrors"];

export default function SongsPage() {
  const [assets, setAssets] = useState<LedgerAsset[]>([]);
  const [plant, setPlant] = useState<LoopPlant | null>(null);

  useEffect(() => {
    const all = readLedger();
    setAssets(
      all.filter((a) => KEEP.some((k) => a.title.includes(k))).slice(0, 2)
    );
    setPlant(readPersistedPlant());
  }, []);

  const last = plant?.M.ledger[0];

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Songs" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">Music rail · proof single</p>
        <h1 className="text-3xl font-bold mb-3">Shiyan Yishu</h1>
        <p className="text-zinc-400 max-w-2xl mb-8">
          The single proves Shiyan AI Assist. The next action and the error
          drop come from the loop, not from a static package.
        </p>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-8">
          <p className="text-xs text-emerald-400 mb-3">Bound loop</p>
          {plant ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-zinc-500">t</p>
                <p className="text-xl">{plant.t}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">last y</p>
                <p className="text-xl">{plant.M.last_y ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">e on B</p>
                <p className="text-xl">{plant.M.last_e}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Δe</p>
                <p className="text-xl">{last?.reduced ?? "—"}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              No loop memory yet. Step once on /loop, then come back.
            </p>
          )}
          <Link
            href="/loop"
            className="inline-flex mt-5 h-10 px-5 rounded-full bg-white text-black text-sm items-center"
          >
            Step the loop
          </Link>
        </div>

        <div className="space-y-4">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6"
            >
              <h2 className="text-lg font-semibold mb-2">{asset.title}</h2>
              <p className="text-sm text-zinc-500 mb-5">
                id {asset.id} · {asset.state}
                {asset.title.includes("Shiyan Yishu") && plant?.M.last_y
                  ? ` · next action ${plant.M.last_y}`
                  : ""}
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
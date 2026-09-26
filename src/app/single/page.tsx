"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { LedgerAsset, readLedger } from "@/lib/ledger";

const CLUSTER_A = "cluster:A";
const CONTAINER_A = "container:founder-music";
const AGENT_A = "Workspace A · founder music";

export default function SongsPage() {
  const [assets, setAssets] = useState<LedgerAsset[]>([]);
  const [openA, setOpenA] = useState(true);

  useEffect(() => {
    setAssets(readLedger().filter((row) => row.id.startsWith("cl_")));
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Songs" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-3">Songs</h1>
        <p className="text-zinc-400 mb-8">
          Workspace A holds founder music. Workbench B is not a customer
          catalog. Listen at ecmccready.com/songs.
        </p>

        <button
          onClick={() => setOpenA((v) => !v)}
          className="w-full text-left bg-zinc-900/60 border border-emerald-800 rounded-2xl p-6 mb-6"
        >
          <p className="text-xs text-emerald-400 mb-2">
            {CLUSTER_A} · {CONTAINER_A} · {openA ? "open" : "closed"}
          </p>
          <h2 className="text-2xl font-semibold mb-1">{AGENT_A}</h2>
          <p className="text-sm text-zinc-500">{assets.length} contained songs</p>
        </button>

        {openA ? (
          <div className="space-y-4 pl-2 border-l border-emerald-800">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6"
              >
                <h3 className="text-xl font-semibold mb-2">{asset.title}</h3>
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
        ) : null}
      </main>
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { WORKSPACE } from "@/lib/workspace";
import { readTrades } from "@/lib/trade";
import { readPings } from "@/lib/ping";
import { computeB, Self, readOutcomes } from "@/lib/outcomes";
import { readLedger } from "@/lib/ledger";

export default function WorkspacePage() {
  const [trades, setTrades] = useState(0);
  const [accepted, setAccepted] = useState(0);
  const [rejected, setRejected] = useState(0);
  const [pings, setPings] = useState(0);
  const [assets, setAssets] = useState(0);
  const [z, setZ] = useState("");
  const [b, setB] = useState("");

  useEffect(() => {
    const rows = readTrades();
    setTrades(rows.length);
    setAccepted(rows.filter((row) => row.state === "accepted").length);
    setRejected(rows.filter((row) => row.state === "rejected").length);
    setPings(readPings().filter((row) => row.observed === 1).length);
    setAssets(readLedger().length);
    const outcomes = readOutcomes();
    setZ(Self(outcomes).z);
    setB(computeB(outcomes).action);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workspace" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">slice_v12 · container · not an enterprise product</p>
        <h1 className="text-3xl font-bold mb-3">{WORKSPACE.label}</h1>
        <p className="text-zinc-400 mb-8">
          Workspace holds channels. Channels hold agents, assets, and trades. The ledger names z. computeB names the next action. This page does not write settlement.
        </p>

        <section className="bg-zinc-900/60 border border-emerald-800 rounded-2xl p-6 mb-6">
          <p className="text-xs text-emerald-400 mb-2">Global state · ledger</p>
          <p className="text-xl">{z || "Observe."}</p>
          <p className="text-zinc-500 mt-2">
            Computed B {b} · assets {assets} · trades {trades} · accepted {accepted} · rejected {rejected} · pings {pings}
          </p>
          <p className="text-zinc-600 text-sm mt-2">enterprise_product false · level3 false</p>
        </section>

        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {WORKSPACE.channels.map((channel) => (
            <section key={channel.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
              <p className="text-xs text-emerald-400 mb-2">{channel.id}</p>
              <h2 className="text-xl font-semibold mb-2">{channel.label}</h2>
              <p className="text-sm text-zinc-400 mb-4">{channel.role}</p>
              <p className="text-sm text-zinc-500">
                {channel.id === "channel-a"
                  ? `offers ${trades} · closes ${accepted + rejected}`
                  : "live B unset · WAIT_EXTERNAL is correct"}
              </p>
            </section>
          ))}
        </div>

        <p className="text-sm text-zinc-500 mb-6">
          Week of 6 October 2026 · Buy as B $1 on /nfts. Not on this page.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link href="/trade" className="h-11 px-6 rounded-full bg-emerald-600 text-sm inline-flex items-center">
            Trade
          </Link>
          <Link href="/ping" className="h-11 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center">
            Ping
          </Link>
          <Link href="/nfts" className="h-11 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center">
            Prove
          </Link>
          <Link href="/upload" className="h-11 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center">
            Upload
          </Link>
        </div>
      </main>
    </div>
  );
}
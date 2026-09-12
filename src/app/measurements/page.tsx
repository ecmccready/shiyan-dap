"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { LedgerAsset, readLedger } from "@/lib/ledger";
import {
  OutcomeTransition,
  nextAction,
  readOutcomes,
  recordOutcome,
  simulatePair,
  yFromAsset,
} from "@/lib/outcomes";
import { VERTICALS, readVertical } from "@/lib/verticles";

const places = [
  { href: "/upload", label: "Share files" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/playlist", label: "Playlist" },
  { href: "/single", label: "Songs" },
  { href: "/nfts", label: "Proven" },
];

export default function LearnPage() {
  const [assets, setAssets] = useState<LedgerAsset[]>([]);
  const [outcomes, setOutcomes] = useState<OutcomeTransition[]>([]);
  const [vertical, setVertical] = useState("music");
  const [action, setAction] = useState("INITIATE_TRADE");
  const [z, setZ] = useState("");

  const selected = VERTICALS.find((v) => v.id === vertical) || VERTICALS[0];
  const official = assets.filter((a) => a.id.startsWith("cl_"));
  const aAsset = official[0];
  const bAsset = official[1] || official[0];
  const yA = yFromAsset(aAsset?.state || "listed");
  const yB = yFromAsset(bAsset?.state || "listed");

  useEffect(() => {
    setVertical(readVertical());
    const rows = readOutcomes();
    setAssets(readLedger());
    setOutcomes(rows);
    setZ(nextAction(rows));
  }, []);

  useEffect(() => {
    if (selected?.actions?.[0]) setAction(selected.actions[0]);
  }, [selected]);

  const refresh = () => {
    const rows = readOutcomes();
    setOutcomes(rows);
    setZ(nextAction(rows));
  };

  const measure = (asset: LedgerAsset, agent: string) => {
    const y_after = yFromAsset(asset.state);
    const prior = outcomes.filter((o) => o.asset_id === asset.id).pop();
    recordOutcome({
      asset_id: asset.id,
      action,
      y_before: prior ? prior.y_after : y_after,
      y_after,
      vertical: agent.startsWith("Agent A") ? "music" : vertical,
      agent,
      simulated: false,
    });
    refresh();
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Learn" />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">P2P State Machine</p>
        <h1 className="text-3xl font-bold mb-3">y(A, x) + y(B, x) = z</h1>
        <p className="text-zinc-400 mb-8">
          A is Music. B is the other square. Learn, share files, Marketplace, Playlist, Songs, Proven.
        </p>
        <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 items-stretch mb-8">
          <div className="rounded-2xl border border-emerald-700 bg-zinc-900/60 p-6 min-h-56">
            <p className="text-xs text-emerald-400 mb-2">A · x = Music</p>
            <h2 className="text-xl font-semibold mb-2">Agent A · ECMcCready</h2>
            <p className="text-sm text-zinc-400 mb-4">
              {aAsset?.title || "Shiyan Yishu — First Single"} · {aAsset?.state || "listed"}
            </p>
            <p className="text-sm text-zinc-500 mb-6">
              y.settlement {yA.settlement} · y.acquisition {yA.acquisition}
            </p>
            {aAsset ? (
              <button
                onClick={() => measure(aAsset, "Agent A · ECMcCready")}
                className="h-11 px-5 rounded-full bg-emerald-600 text-sm"
              >
                Measure A
              </button>
            ) : null}
          </div>
          <div className="flex items-center justify-center text-2xl font-semibold text-zinc-500">+</div>
          <div className="rounded-2xl border border-zinc-700 bg-zinc-900/60 p-6 min-h-56">
            <p className="text-xs text-emerald-400 mb-2">B · x = {selected.label}</p>
            <h2 className="text-xl font-semibold mb-2">Agent B · this session</h2>
            <p className="text-sm text-zinc-400 mb-4">
              {bAsset?.title || "Sleep Terrors — Second Single"} · {bAsset?.state || "listed"}
            </p>
            <p className="text-sm text-zinc-500 mb-6">
              y.settlement {yB.settlement} · y.acquisition {yB.acquisition}
            </p>
            {bAsset ? (
              <button
                onClick={() => measure(bAsset, "Agent B · this session")}
                className="h-11 px-5 rounded-full border border-zinc-600 text-sm"
              >
                Measure B
              </button>
            ) : null}
          </div>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-8">
          <p className="text-xs text-emerald-400 mb-2">z</p>
          <p className="text-xl font-semibold mb-4">{z || "Measure A and B."}</p>
          <div className="flex flex-wrap gap-3 mb-4">
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="h-11 rounded-full bg-zinc-900 border border-zinc-800 px-4"
            >
              {(selected.actions || ["INITIATE_TRADE"]).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                simulatePair(vertical, action, "sim_" + vertical);
                refresh();
              }}
              className="h-11 px-5 rounded-full border border-zinc-700 text-sm"
            >
              Simulate A/B
            </button>
            <Link href="/bot" className="h-11 px-5 rounded-full bg-emerald-600 text-sm inline-flex items-center">
              Act
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {places.map((place) => (
              <Link
                key={place.href}
                href={place.href}
                className="h-10 px-4 rounded-full border border-zinc-700 text-sm inline-flex items-center"
              >
                {place.label}
              </Link>
            ))}
          </div>
          <p className="text-sm text-zinc-500 mt-4">Simulation is not live demand.</p>
        </div>
        <div className="space-y-3">
          {outcomes.slice().reverse().map((row) => (
            <p key={row.measurement_id} className="text-sm text-zinc-400">
              {row.agent} · {row.vertical} · {row.action} · {row.transition_class}
              {row.simulated ? " · sim" : ""}
            </p>
          ))}
        </div>
      </main>
    </div>
  );
}
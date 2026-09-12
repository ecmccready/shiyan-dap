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

export default function LearnPage() {
  const [assets, setAssets] = useState<LedgerAsset[]>([]);
  const [outcomes, setOutcomes] = useState<OutcomeTransition[]>([]);
  const [vertical, setVertical] = useState("music");
  const [action, setAction] = useState("INITIATE_TRADE");
  const [z, setZ] = useState("");

  const selected = VERTICALS.find((v) => v.id === vertical) || VERTICALS[0];
  const official = assets.filter((a) => a.id.startsWith("cl_"));
  const escrow = assets.filter((a) => a.state === "escrow").length;
  const settled = assets.filter((a) => a.state === "settled").length;

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

  const measure = (asset: LedgerAsset) => {
    const y_after = yFromAsset(asset.state);
    const prior = outcomes.filter((o) => o.asset_id === asset.id).pop();
    recordOutcome({
      asset_id: asset.id,
      action,
      y_before: prior ? prior.y_after : y_after,
      y_after,
      vertical,
      agent: "Agent B · this session",
      simulated: false,
    });
    refresh();
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Learn" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">Learn</p>
        <h1 className="text-3xl font-bold mb-3">Learn</h1>
        <p className="text-zinc-400 mb-8">
          Counts from this browser. Domain comes from the header. Simulate A/B writes OutcomeTransition rows.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            ["Official singles", official.length],
            ["Escrow", escrow],
            ["Settled", settled],
            ["Mint queued", settled],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-zinc-800 p-5">
              <p className="text-xs text-zinc-500 mb-2">{label}</p>
              <p className="text-3xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-8">
          <p className="text-xs text-emerald-400 mb-2">z</p>
          <p className="text-xl font-semibold mb-4">{z || "Measure or simulate."}</p>
          <div className="flex flex-wrap gap-3">
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="h-11 rounded-full bg-zinc-900 border border-zinc-800 px-4"
            >
              {(selected.actions || ["INITIATE_TRADE"]).map((a) => (
                <option key={a} value={a}>
                  {a}
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
            <Link
              href="/bot"
              className="h-11 px-5 rounded-full bg-emerald-600 text-sm inline-flex items-center"
            >
              Act
            </Link>
          </div>
          <p className="text-sm text-zinc-500 mt-4">
            Domain: {selected.label}. Simulation is not live demand.
          </p>
        </div>
        <div className="space-y-4 mb-10">
          {assets.map((asset) => (
            <div key={asset.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-2">{asset.title}</h2>
              <p className="text-sm text-zinc-500 mb-4">{asset.state}</p>
              <button
                onClick={() => measure(asset)}
                className="h-11 px-5 rounded-full bg-emerald-600 text-sm"
              >
                Measure again
              </button>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {outcomes.slice().reverse().map((row) => (
            <p key={row.measurement_id} className="text-sm text-zinc-400">
              {row.vertical} · {row.agent} · {row.action} · {row.transition_class}
              {row.simulated ? " · sim" : ""}
            </p>
          ))}
        </div>
      </main>
    </div>
  );
}
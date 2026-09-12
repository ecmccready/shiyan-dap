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
import { VERTICALS } from "@/lib/verticles";

export default function LearnPage() {
  const [assets, setAssets] = useState<LedgerAsset[]>([]);
  const [outcomes, setOutcomes] = useState<OutcomeTransition[]>([]);
  const [vertical, setVertical] = useState("music");
  const [action, setAction] = useState("INITIATE_TRADE");
  const [z, setZ] = useState("");

  const selected = VERTICALS.find((v) => v.id === vertical) || VERTICALS[0];

  useEffect(() => {
    const rows = readOutcomes();
    setAssets(readLedger());
    setOutcomes(rows);
    setZ(nextAction(rows));
  }, []);

  useEffect(() => {
    setAction(selected.actions[0]);
  }, [selected]);

  const refresh = () => {
    const rows = readOutcomes();
    setOutcomes(rows);
    setZ(nextAction(rows));
  };

  const measure = (asset: LedgerAsset) => {
    const y_after = yFromAsset(asset.state);
    const prior = outcomes.filter((o) => o.asset_id === asset.id).pop();
    const y_before = prior ? prior.y_after : y_after;
    recordOutcome({
      asset_id: asset.id,
      action,
      y_before,
      y_after,
      vertical,
      agent: "Agent B · this session",
      simulated: false,
    });
    refresh();
  };

  const simulate = () => {
    simulatePair(vertical, action, "sim_" + vertical);
    refresh();
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Learn" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">Learn</p>
        <h1 className="text-3xl font-bold mb-3">Learn</h1>
        <p className="text-zinc-400 mb-8">
          CRM loop. Pick a vertical. A/B agents write simulated P2P signals. z is the next action.
        </p>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-8">
          <p className="text-xs text-emerald-400 mb-2">z</p>
          <p className="text-xl font-semibold mb-4">{z || "Measure or simulate."}</p>
          <Link href="/bot" className="h-11 px-6 rounded-full bg-emerald-600 text-sm inline-flex items-center">
            Act
          </Link>
        </div>
        <div className="flex flex-wrap gap-3 mb-6">
          <select
            value={vertical}
            onChange={(e) => setVertical(e.target.value)}
            className="h-12 rounded-2xl bg-zinc-900 border border-zinc-800 px-4"
          >
            {VERTICALS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label} · {v.asset}
              </option>
            ))}
          </select>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="h-12 rounded-2xl bg-zinc-900 border border-zinc-800 px-4"
          >
            {selected.actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <button onClick={simulate} className="h-12 px-5 rounded-full border border-zinc-700 text-sm">
            Simulate A/B
          </button>
        </div>
        <p className="text-sm text-zinc-500 mb-8">
          First Y for {selected.label}: {selected.firstY}. Simulation is not live demand.
        </p>
        <div className="space-y-4 mb-10">
          {assets.map((asset) => {
            const y = yFromAsset(asset.state);
            return (
              <div key={asset.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
                <h2 className="text-lg font-semibold mb-2">{asset.title}</h2>
                <p className="text-sm text-zinc-500 mb-4">
                  settlement {y.settlement} · acquisition {y.acquisition} · audience {y.audience_response} · conversion {y.conversion} · revenue {y.revenue} · retention {y.retention}
                </p>
                <button onClick={() => measure(asset)} className="h-11 px-5 rounded-full bg-emerald-600 text-sm">
                  Measure again
                </button>
              </div>
            );
          })}
        </div>
        <div className="space-y-3">
          {outcomes
            .slice()
            .reverse()
            .map((row) => (
              <p key={row.measurement_id} className="text-sm text-zinc-400">
                {row.vertical} · {row.agent} · {row.action} · {row.y_before.settlement}→{row.y_after.settlement} · {row.transition_class}
                {row.simulated ? " · sim" : ""}
              </p>
            ))}
        </div>
      </main>
    </div>
  );
}
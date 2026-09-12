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

const crm = [
  { href: "/upload", label: "Create", stage: "lead" },
  { href: "/nfts", label: "Prove", stage: "qualify" },
  { href: "/measurements", label: "Learn", stage: "measure" },
  { href: "/bot", label: "Act", stage: "next" },
];

export default function LearnPage() {
  const [assets, setAssets] = useState<LedgerAsset[]>([]);
  const [outcomes, setOutcomes] = useState<OutcomeTransition[]>([]);
  const [vertical, setVertical] = useState("music");
  const [action, setAction] = useState("INITIATE_TRADE");
  const [z, setZ] = useState("");

  const selected = VERTICALS.find((v) => v.id === vertical) || VERTICALS[0];
  const founder = assets.filter((a) => a.id.startsWith("cl_"));
  const clusterA = outcomes.filter((row) => row.agent.includes("Agent A"));
  const clusterB = outcomes.filter((row) => row.agent.includes("Agent B"));

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

  const measureA = (asset: LedgerAsset) => {
    const y_after = yFromAsset(asset.state);
    const prior = outcomes.filter((o) => o.asset_id === asset.id).pop();
    recordOutcome({
      asset_id: asset.id,
      action,
      y_before: prior ? prior.y_after : y_after,
      y_after,
      vertical: "music",
      agent: "Agent A · ECMcCready",
      simulated: false,
    });
    refresh();
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Learn" />
        <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 items-start mb-8">
          <div className="rounded-2xl border border-emerald-700 bg-zinc-900/60 p-6">
            <p className="text-xs text-emerald-400 mb-2">A cluster · Music · founder agent</p>
            <h2 className="text-xl font-semibold mb-4">Agent A · ECMcCready</h2>
            <div className="space-y-3 mb-6">
              {founder.map((asset) => {
                const y = yFromAsset(asset.state);
                return (
                  <div key={asset.id} className="border border-zinc-800 rounded-xl p-4">
                    <p className="font-medium">{asset.title}</p>
                    <p className="text-sm text-zinc-500 mb-3">
                      {asset.state} · Y {y.settlement}
                    </p>
                    <button
                      onClick={() => measureA(asset)}
                      className="h-10 px-4 rounded-full bg-emerald-600 text-sm"
                    >
                      Measure A
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-zinc-500 mb-2">x in this container</p>
            <div className="space-y-2">
              {clusterA.slice(-6).reverse().map((row) => (
                <p key={row.measurement_id} className="text-sm text-zinc-400">
                  Y {row.y_before.settlement}→{row.y_after.settlement} · {row.action} · {row.transition_class}
                </p>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center text-2xl font-semibold text-zinc-500 pt-24">+</div>
          <div className="rounded-2xl border border-dashed border-zinc-600 bg-zinc-900/40 p-6">
            <p className="text-xs text-emerald-400 mb-2">B cluster · placeholder peer</p>
            <h2 className="text-xl font-semibold mb-2">Agent B · fictional CRM seat</h2>
            <p className="text-sm text-zinc-400 mb-4">
              Portable agent. Not a second live user. CRM stages only.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {crm.map((step) => (
                <Link
                  key={step.href + step.stage}
                  href={step.href}
                  className="h-10 px-3 rounded-full border border-zinc-700 text-xs inline-flex items-center justify-center"
                >
                  {step.label} · {step.stage}
                </Link>
              ))}
            </div>
            <button
              onClick={() => {
                simulatePair(vertical, action, "sim_placeholder_b");
                refresh();
              }}
              className="h-11 px-5 rounded-full border border-zinc-600 text-sm mb-6"
            >
              Simulate B
            </button>
            <div className="space-y-2">
              {clusterB.slice(-6).reverse().map((row) => (
                <p key={row.measurement_id} className="text-sm text-zinc-500">
                  Y {row.y_before.settlement}→{row.y_after.settlement} · {row.vertical} · sim
                </p>
              ))}
            </div>
          </div>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
          <p className="text-xs text-emerald-400 mb-2">z · next best action</p>
          <p className="text-xl font-semibold mb-4">{z || "Measure the A cluster."}</p>
          <div className="flex flex-wrap gap-3">
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
        </div>
      </main>
    </div>
  );
}
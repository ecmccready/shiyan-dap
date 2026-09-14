"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { LedgerAsset, readLedger } from "@/lib/ledger";
import {
  OutcomeTransition,
  f,
  gapToOne,
  nextAction,
  pairZ,
  readOutcomes,
  recordBReturn,
  recordOutcome,
  simulatePair,
  yFromAsset,
} from "@/lib/outcomes";
import { VERTICALS, readVertical } from "@/lib/verticles";

const ZERO = {
  settlement: 0 as const,
  acquisition: 0 as const,
  audience_response: 0 as const,
  conversion: 0 as const,
  revenue: 0 as const,
  retention: 0 as const,
};

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
  const [liveB, setLiveB] = useState(false);
  const [returnedFlag, setReturnedFlag] = useState(false);
  const [remoteZ, setRemoteZ] = useState("");

  const selected = VERTICALS.find((v) => v.id === vertical) || VERTICALS[0];
  const founder = assets.filter((a) => a.id.startsWith("cl_"));
  const clusterA = outcomes.filter((row) => row.agent.includes("Agent A"));
  const clusterB = outcomes.filter((row) => row.agent.includes("Agent B"));
  const liveBRow = clusterB.filter((row) => !row.simulated && row.y_after.settlement === 1).pop();
  const returned =
    returnedFlag || clusterB.some((row) => !row.simulated && row.action === "RETURN");
  const yA = yFromAsset(founder[0]?.state || "listed");
  const yB = liveBRow ? liveBRow.y_after : ZERO;
  const localZ = pairZ(yA, yB, returned);
  const z = returned ? localZ : remoteZ || localZ;

  useEffect(() => {
    setVertical(readVertical());
    setAssets(readLedger());
    setOutcomes(readOutcomes());
    setLiveB(window.localStorage.getItem("shiyan-b-live") === "1");
    setReturnedFlag(window.localStorage.getItem("shiyan-b-return") === "1");
    fetch("/api/memory")
      .then((r) => r.json())
      .then((data) => {
        if (data?.z) {
          setRemoteZ(data.z);
          window.localStorage.setItem("shiyan-z", data.z);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selected?.actions?.[0]) setAction(selected.actions[0]);
  }, [selected]);

  const refresh = () => {
    setOutcomes(readOutcomes());
    setLiveB(window.localStorage.getItem("shiyan-b-live") === "1");
    setReturnedFlag(window.localStorage.getItem("shiyan-b-return") === "1");
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
      <main className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-8">Learn</h1>
        <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 items-start mb-8">
          <div className="rounded-2xl border border-emerald-700 bg-zinc-900/60 p-6">
            <p className="text-xs text-emerald-400 mb-2">A cluster · Music · founder</p>
            <h2 className="text-xl font-semibold mb-4">Agent A · ECMcCready</h2>
            <p className="text-sm text-zinc-500 mb-4">
              f(A) {f(yA)} · gap {gapToOne(yA)}
            </p>
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
            <div className="space-y-2">
              {clusterA
                .filter((row) => !row.simulated)
                .slice(-6)
                .reverse()
                .map((row) => (
                  <p key={row.measurement_id} className="text-sm text-zinc-400">
                    Y {row.y_before.settlement}→{row.y_after.settlement} · {row.action} · {row.transition_class}
                  </p>
                ))}
            </div>
          </div>
          <div className="flex items-center justify-center text-2xl font-semibold text-zinc-500 pt-24">+</div>
          <div className="rounded-2xl border border-dashed border-zinc-600 bg-zinc-900/40 p-6">
            <p className="text-xs text-emerald-400 mb-2">
              B cluster · {liveB || liveBRow ? "live payment seen" : "placeholder"}
            </p>
            <h2 className="text-xl font-semibold mb-2">Agent B · potential customer</h2>
            <p className="text-sm text-zinc-400 mb-4">
              f(B) {f(yB)} · gap {gapToOne(yB)}
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
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={() => {
                  simulatePair(vertical, action, "sim_placeholder_b");
                  refresh();
                }}
                className="h-11 px-5 rounded-full border border-zinc-600 text-sm"
              >
                Simulate B
              </button>
              <button
                onClick={() => {
                  recordBReturn();
                  refresh();
                }}
                className="h-11 px-5 rounded-full bg-emerald-600 text-sm"
              >
                B returned
              </button>
            </div>
            <div className="space-y-2">
              {clusterB.slice(-6).reverse().map((row) => (
                <p key={row.measurement_id} className="text-sm text-zinc-500">
                  Y {row.y_before.settlement}→{row.y_after.settlement} · {row.action}
                  {row.simulated ? " · sim" : " · live"}
                </p>
              ))}
            </div>
          </div>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
          <p className="text-xs text-emerald-400 mb-2">z = π(Y, x) = pairZ(A, B) · Hub latest-z.json</p>
          <p className="text-xl font-semibold mb-4">{z}</p>
          <Link href="/bot" className="h-11 px-5 rounded-full bg-emerald-600 text-sm inline-flex items-center">
            Act
          </Link>
        </div>
      </main>
    </div>
  );
}
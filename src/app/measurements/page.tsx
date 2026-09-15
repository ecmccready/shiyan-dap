"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { LedgerAsset, readLedger } from "@/lib/ledger";
import {
  OutcomeTransition,
  computeB,
  errorSignal,
  f,
  pairZ,
  readOutcomes,
  recordAudience,
  recordOutcome,
  recordSelf,
  resolveB,
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
  const [remoteZ, setRemoteZ] = useState("");

  const selected = VERTICALS.find((v) => v.id === vertical) || VERTICALS[0];
  const founder = assets.filter((a) => a.id.startsWith("cl_"));
  const clusterA = outcomes.filter((row) => row.agent.includes("Agent A"));
  const clusterB = outcomes.filter((row) => row.agent.includes("Agent B"));
  const liveBRow = clusterB.filter((row) => !row.simulated && row.y_after.settlement === 1).pop();
  const bState = resolveB(outcomes);
  const computed = computeB(outcomes);
  const yA = yFromAsset(founder[0]?.state || "listed");
  const yB = liveBRow ? liveBRow.y_after : ZERO;
  const localZ = pairZ(yA, yB, bState.returned);
  const z = bState.resolution === "resolved" ? "B returned. Hold." : remoteZ || localZ;

  useEffect(() => {
    setVertical(readVertical());
    setAssets(readLedger());
    setOutcomes(readOutcomes());
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
    setOutcomes(readOutcomes());
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Learn" />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <p className="text-xs text-emerald-400 mb-2">Experimental / control layer</p>
        <h1 className="text-3xl font-bold mb-3">Learn</h1>
        <p className="text-zinc-400 mb-8">
          You do not choose B. computeB() does. External $1 is validation later.
        </p>
        <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 items-start mb-8">
          <div className="rounded-2xl border border-emerald-700 bg-zinc-900/60 p-6">
            <p className="text-xs text-emerald-400 mb-2">Control · A · known successful</p>
            <h2 className="text-xl font-semibold mb-4">Agent A · ECMcCready</h2>
            <p className="text-sm text-zinc-500 mb-4">
              r 1 · y {f(yA)} · e {errorSignal(yA)}
            </p>
            <div className="space-y-3 mb-6">
              {founder.map((asset) => {
                const y = yFromAsset(asset.state);
                const isFirst = asset.title.toLowerCase().includes("yishu");
                return (
                  <div key={asset.id} className="border border-zinc-800 rounded-xl p-4">
                    <p className="font-medium">{asset.title}</p>
                    <p className="text-sm text-zinc-500 mb-3">
                      {asset.state} · Y {y.settlement}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => measureA(asset)}
                        className="h-10 px-4 rounded-full bg-emerald-600 text-sm"
                      >
                        Measure A
                      </button>
                      {isFirst ? (
                        <button
                          onClick={() => {
                            recordAudience(asset.id);
                            setOutcomes(readOutcomes());
                          }}
                          className="h-10 px-4 rounded-full border border-zinc-700 text-sm"
                        >
                          Record listen
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="space-y-2">
              {clusterA
                .filter((row) => !row.simulated)
                .slice(-8)
                .reverse()
                .map((row) => (
                  <p key={row.measurement_id} className="text-sm text-zinc-400">
                    Y {row.y_before.settlement}→{row.y_after.settlement}
                    {row.action === "OBSERVE_AUDIENCE"
                      ? " · audience " + row.y_before.audience_response + "→" + row.y_after.audience_response
                      : ""}{" "}
                    · {row.action} · {row.transition_class}
                  </p>
                ))}
            </div>
          </div>
          <div className="flex items-center justify-center text-2xl font-semibold text-zinc-500 pt-24">+</div>
          <div className="rounded-2xl border border-dashed border-zinc-600 bg-zinc-900/40 p-6">
            <p className="text-xs text-emerald-400 mb-2">
              Experiment · computed {computed.step} · {computed.action}
            </p>
            <h2 className="text-xl font-semibold mb-2">B from state, z, e</h2>
            <p className="text-sm text-zinc-400 mb-4">
              r 1 · y {f(yB)} · e {errorSignal(yB)} · {bState.resolution}
            </p>
            <p className="text-sm text-zinc-500 mb-6">
              You are the operator. Do not pick B manually.
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
            <div className="space-y-2">
              {clusterB
                .filter((row) => !row.simulated)
                .slice(-6)
                .reverse()
                .map((row) => (
                  <p key={row.measurement_id} className="text-sm text-zinc-500">
                    Y {row.y_before.settlement}→{row.y_after.settlement} · {row.action} · live
                  </p>
                ))}
            </div>
          </div>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
          <p className="text-xs text-emerald-400 mb-2">Self() · computeB() · operator view</p>
          <p className="text-xl font-semibold mb-3">{z}</p>
          <p className="text-sm text-zinc-400 mb-2">
            Computed {computed.step}: {computed.action} · e {computed.e} · {computed.source}
          </p>
          <p className="text-sm text-zinc-500 mb-4">
            Given current state and observed z, this is the next action.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/bot" className="h-11 px-5 rounded-full bg-emerald-600 text-sm inline-flex items-center">
              Act
            </Link>
            <button
              onClick={() => {
                try {
                  recordSelf();
                  setOutcomes(readOutcomes());
                  window.location.href = "/outcomes";
                } catch {
                  window.location.href = "/outcomes";
                }
              }}
              className="h-11 px-5 rounded-full border border-zinc-700 text-sm"
            >
              Record Self()
            </button>
            <a
              href="https://huggingface.co/datasets/shiyan-dap/founder-z/blob/main/latest-z.json"
              target="_blank"
              rel="noreferrer"
              className="h-11 px-5 rounded-full border border-zinc-700 text-sm inline-flex items-center"
            >
              Preserve evidence
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
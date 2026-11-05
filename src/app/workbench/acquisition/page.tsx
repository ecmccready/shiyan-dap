"use client";

import React, { useState } from "react";

const FIXTURE = [
  {
    id: "opp-1",
    prospect: "Robotics lead",
    organization: "Tesla Optimus",
    problem: "Long-horizon task reliability and intervention reduction",
    match: "Developer Workbench",
    offer: "Paired experiment on look-back vs greedy with verified evidence pack",
  },
  {
    id: "opp-2",
    prospect: "Research director",
    organization: "Physical Intelligence",
    problem: "Policy evaluation and measurable improvement",
    match: "Developer Workbench",
    offer: "Deterministic seed-controlled experiment with reproducibility hash",
  },
  {
    id: "opp-3",
    prospect: "Program lead",
    organization: "Figure AI",
    problem: "Independent evidence of whole-body performance",
    match: "Global Workbench",
    offer: "Traceable investigation with source-linked findings and human review",
  },
];

export default function AcquisitionPage() {
  const [approved, setApproved] = useState<Record<string, boolean>>({});

  function approve(id: string) {
    setApproved((prev) => ({ ...prev, [id]: true }));
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-4xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-emerald-400 mb-4">
          Aethel Node · Acquisition Agent
        </p>

        <h1 className="text-4xl font-semibold mb-6">Opportunity qualification</h1>

        <p className="text-zinc-300 mb-10">
          The agent finds prospects, identifies a measurable problem, matches it to Global or Developer Workbench, and drafts a specific offer. Human approval is required before any outreach.
        </p>

        <div className="space-y-6">
          {FIXTURE.map((opp) => (
            <div key={opp.id} className="border border-zinc-800 rounded-xl p-6 bg-zinc-950">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="font-semibold">{opp.prospect}</div>
                  <div className="text-sm text-zinc-400">{opp.organization}</div>
                </div>
                <span className="text-xs bg-zinc-800 px-2 py-1 rounded">{opp.match}</span>
              </div>

              <div className="mb-3">
                <div className="text-sm text-zinc-400">Problem</div>
                <div>{opp.problem}</div>
              </div>

              <div className="mb-4">
                <div className="text-sm text-zinc-400">Drafted offer</div>
                <div>{opp.offer}</div>
              </div>

              {approved[opp.id] ? (
                <div className="text-emerald-400 text-sm">Approved for outreach</div>
              ) : (
                <button
                  onClick={() => approve(opp.id)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded text-sm"
                >
                  Approve outreach
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-zinc-500 mt-10">
          Synthetic fixture. Real prospect research and approved outreach remain gated until the five evidence conditions are met.
        </p>
      </main>
    </div>
  );
}
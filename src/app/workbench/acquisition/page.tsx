"use client";

import { useState } from "react";
import Link from "next/link";

type Opportunity = {
  id: string;
  recipient: string;
  organization: string;
  problem: string;
  evidence_hash: string;
  originating_run: string;
  contact_date: string;
  response: string;
  next_action: string;
  stage: "identified" | "presented" | "engaged" | "pilot" | "measured";
};

const FIXTURE: Opportunity[] = [
  {
    id: "opp-1",
    recipient: "Robotics lead",
    organization: "Tesla Optimus",
    problem: "Long-horizon task reliability and intervention reduction",
    evidence_hash: "sha256:a1b2c3d4e5f6",
    originating_run: "/workbench/robotics/experiment",
    contact_date: "2026-11-03",
    response: "Requested seed re-run",
    next_action: "Send verified pack",
    stage: "presented",
  },
  {
    id: "opp-2",
    recipient: "Research director",
    organization: "Physical Intelligence",
    problem: "Policy evaluation and measurable improvement",
    evidence_hash: "sha256:b2c3d4e5f6a1",
    originating_run: "/workbench/robotics/experiment",
    contact_date: "2026-11-02",
    response: "Asked for protocol",
    next_action: "Link benchmark",
    stage: "engaged",
  },
  {
    id: "opp-3",
    recipient: "Program lead",
    organization: "Figure AI",
    problem: "Independent evidence of whole-body performance",
    evidence_hash: "sha256:c3d4e5f6a1b2",
    originating_run: "/workbench/robotics/experiment",
    contact_date: "2026-11-01",
    response: "No response",
    next_action: "Follow up",
    stage: "identified",
  },
];

export default function AcquisitionPage() {
  const [filter, setFilter] = useState<"all" | Opportunity["stage"]>("all");
  const shown = filter === "all" ? FIXTURE : FIXTURE.filter((o) => o.stage === filter);

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Aethel Node · Acquisition Intelligence</h1>
      <p className="text-sm text-neutral-500 mb-4">
        Synthetic fixture. Display only. Every opportunity references an evidence-pack hash and originating run. Real contact tracking remains outside the engine.
      </p>

      <div className="flex gap-2 mb-4 text-sm">
        {(["all", "identified", "presented", "engaged", "pilot", "measured"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`border rounded px-2 py-1 ${filter === s ? "bg-neutral-100" : ""}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="border rounded">
        {shown.map((o) => (
          <div key={o.id} className="border-b last:border-b-0 p-3 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">{o.organization}</span>
              <span className="text-neutral-500">{o.stage}</span>
            </div>
            <div className="text-neutral-600 mt-1">{o.problem}</div>
            <div className="text-xs text-neutral-500 mt-1">
              Recipient: {o.recipient} · Contact: {o.contact_date}
            </div>
            <div className="text-xs mt-1">
              Evidence: {o.evidence_hash} ·{" "}
              <Link href={o.originating_run} className="underline">
                originating run
              </Link>
            </div>
            <div className="text-xs mt-1">
              Response: {o.response} · Next: {o.next_action}
            </div>
          </div>
        ))}
      </div>

      <section className="mt-6 text-sm border rounded p-3">
        <h2 className="font-medium mb-2">Efficiency (synthetic)</h2>
        <div>Opportunities: {FIXTURE.length}</div>
        <div>Presented: {FIXTURE.filter((o) => o.stage !== "identified").length}</div>
        <div>Engaged: {FIXTURE.filter((o) => o.stage === "engaged" || o.stage === "pilot").length}</div>
        <div>Pilot: {FIXTURE.filter((o) => o.stage === "pilot").length}</div>
        <p className="text-xs text-neutral-500 mt-2">
          Conversion, cost per opportunity, time to pilot, and realized revenue are not yet measured. Display only.
        </p>
      </section>
    </main>
  );
}
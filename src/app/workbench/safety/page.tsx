"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import {
  LoopPlant,
  SAFETY_PACK,
  caseById,
  freshPlant,
  loadCase,
  persistPlant,
  readPersistedPlant,
} from "@/lib/closed-loop";
import { SafetyWorkbench } from "@/lib/engine";
import {
  DEFAULT_REFERENCE,
  DiagnosticCaseInput,
  createCaseInput,
  factorsFromLists,
} from "@/product/diagnostic";
import { evaluateDiagnostic } from "@/lib/evaluators/diagnostic-rules";
import {
  FrozenAudit,
  freezeRun,
  handshakeOf,
  shouldFreeze,
} from "@/workbench/safety/gatekeeper";

export default function DiagnosticValidationPage() {
  const [plant, setPlant] = useState<LoopPlant | null>(null);
  const [hypothesis, setHypothesis] = useState("candidate-pathway");
  const [confidence, setConfidence] = useState(0.82);
  const [pathway, setPathway] = useState("clinician_review");
  const [note, setNote] = useState("Load a pack, name a pathway, measure Δe.");
  const [audit, setAudit] = useState<FrozenAudit | null>(null);

  useEffect(() => {
    setPlant(readPersistedPlant() || freshPlant("case-contradictory-notes"));
  }, []);

  const c = plant ? caseById(plant.case_id) : SAFETY_PACK[1];

  const input: DiagnosticCaseInput = useMemo(() => {
    return createCaseInput({
      case_id: c.id,
      domain: "safety",
      presentation: c.presentation,
      factors: factorsFromLists(c.available, c.missing),
      symptoms: [c.presentation],
      risk_factors: c.missing,
      hypothesis,
      hypothesis_confidence: confidence,
      recommended_pathway: pathway,
      contradictions: c.contradictions,
    });
  }, [c, hypothesis, confidence, pathway]);

  const scored = useMemo(
    () => evaluateDiagnostic(input, { ...DEFAULT_REFERENCE, target_gate: c.reference_gate }),
    [input, c.reference_gate]
  );

  const last = plant?.M.ledger[0];
  const e0 = plant?.M.ledger.length
    ? plant.M.ledger[plant.M.ledger.length - 1].e
    : plant?.M.last_e ?? scored.error.e;
  const eNow = plant?.M.last_e ?? scored.error.e;
  const delta = Number(((e0 ?? 0) - (eNow ?? 0)).toFixed(3));
  const frozen = Boolean(audit);

  async function step() {
    if (!plant || frozen) return;
    const out = SafetyWorkbench.step(plant, { namer: "hy4_deep" });
    setPlant(out.plant);
    persistPlant(out.plant);
    const iterations = out.plant.t;
    const decision = shouldFreeze({
      iterations,
      delta_e: Number((e0 - out.rec.e_next).toFixed(3)),
      last_reduction: out.rec.reduced,
    });
    setNote(
      `y=${out.rec.y} · e ${out.rec.e} → ${out.rec.e_next} · reduced=${out.rec.reduced} · gate=${out.rec.gate}`
    );
    if (decision.freeze) {
      const frozenAudit = await freezeRun({
        run_id: `diag_${out.plant.case_id}_${out.plant.t}`,
        e0: e0 ?? out.rec.e,
        e_now: out.rec.e_next,
        iterations,
        gate: out.rec.gate,
        reason: decision.reason,
        history: [
          {
            ...scored,
            y: out.rec.y,
            action_label: out.rec.y,
            gate: out.rec.gate,
            error: { ...scored.error, e: out.rec.e_next },
          },
        ],
      });
      setAudit(frozenAudit);
      setNote(`FROZEN · ${decision.reason} · sha256=${frozenAudit.digest_sha256.slice(0, 16)}…`);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Diagnostic Validation" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
          Commercial core · Δe against reference truth · not a diagnosis
        </p>
        <h1 className="text-3xl font-bold mb-3">Diagnostic Validation Workbench</h1>
        <p className="text-zinc-400 mb-6 max-w-2xl">
          Buyers do not pay for generated text. They pay for verified reduction
          of error. Controller A names y. Workbench B simulates the pathway.
          z is measured. e is scored against the reference pack. If Δe stalls,
          the run freezes for human review.
        </p>

        <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-2xl p-5 mb-8 overflow-auto leading-6 text-emerald-300">
{`REFERENCE TRUTH (guidelines / rules)
                 │
CASE INPUT  →  CONTROLLER A  →  WORKBENCH B  →  z
 (pack)          (namer y)       (simulate)        │
                    ▲                              ▼
                    └──── SELF() ◄──────────── e , Δe`}
        </pre>

        <div className="flex flex-wrap gap-3 mb-8">
          <Link
            href="/"
            className="h-11 px-5 rounded-full border border-zinc-700 text-sm inline-flex items-center"
          >
            Music
          </Link>
          <Link
            href="/workbench"
            className="h-11 px-5 rounded-full border border-zinc-700 text-sm inline-flex items-center"
          >
            Workbench B
          </Link>
          <span className="h-11 px-5 rounded-full border border-emerald-700 text-sm inline-flex items-center text-emerald-400">
            Diagnostic Validation
          </span>
          <Link
            href="/audit"
            className="h-11 px-5 rounded-full bg-emerald-600 text-sm inline-flex items-center"
          >
            Review desk
          </Link>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {SAFETY_PACK.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setAudit(null);
                setPlant((p) => (p ? loadCase(p, item.id) : freshPlant(item.id)));
                setNote(`Loaded ${item.title}`);
              }}
              className={`h-10 px-4 rounded-full text-sm border ${
                plant?.case_id === item.id
                  ? "bg-emerald-600 border-emerald-600"
                  : "border-zinc-700"
              }`}
            >
              {item.title}
            </button>
          ))}
        </div>

        <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-6">
          <p className="text-xs text-emerald-400 mb-2">{c.source}</p>
          <h2 className="text-xl font-semibold mb-2">{c.title}</h2>
          <p className="text-zinc-300 mb-4">{c.presentation}</p>
          <p className="text-sm mb-4">
            Reference gate <b className="text-emerald-400">{c.reference_gate}</b>
            {" · "}
            {c.reference_note}
          </p>
          <div className="grid gap-4 md:grid-cols-2 text-sm">
            <div>
              <p className="text-zinc-500 mb-2">Available</p>
              <ul>
                {c.available.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-zinc-500 mb-2">Missing</p>
              <ul>
                {c.missing.length === 0 ? <li>none</li> : c.missing.map((k) => <li key={k}>{k}</li>)}
              </ul>
            </div>
          </div>
        </section>

        <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-6">
          <p className="text-emerald-400 text-xs mb-3">Action y · model hypothesis</p>
          <div className="grid gap-4 md:grid-cols-3 mb-4">
            <label className="text-sm text-zinc-400">
              Hypothesis
              <input
                value={hypothesis}
                onChange={(e) => setHypothesis(e.target.value)}
                className="mt-2 h-10 w-full rounded-full bg-zinc-950 border border-zinc-700 px-4 text-white"
              />
            </label>
            <label className="text-sm text-zinc-400">
              Confidence
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={confidence}
                onChange={(e) => setConfidence(Number(e.target.value))}
                className="mt-2 h-10 w-full rounded-full bg-zinc-950 border border-zinc-700 px-4 text-white"
              />
            </label>
            <label className="text-sm text-zinc-400">
              Pathway
              <select
                value={pathway}
                onChange={(e) => setPathway(e.target.value)}
                className="mt-2 h-10 w-full rounded-full bg-zinc-950 border border-zinc-700 px-4 text-white"
              >
                <option value="observe">observe</option>
                <option value="hold">hold</option>
                <option value="clinician_review">clinician_review</option>
                <option value="escalate">escalate</option>
              </select>
            </label>
          </div>
          <p className="text-xs font-mono text-zinc-500">
            scored e={scored.error.e} · gate={scored.gate} · spikes=
            {scored.error.spikes.join(" | ") || "none"}
          </p>
        </section>

        <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-8">
          <p className="text-sm text-zinc-300 mb-3">{note}</p>
          <p className="text-xs font-mono text-zinc-500 mb-4">
            handshake={handshakeOf(last?.gate ?? scored.gate, frozen)} ·
            measured gate {last?.gate ?? scored.gate} · e0={e0} · e={eNow} ·
            Δe={delta} · t={plant?.t ?? 0}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={step}
              disabled={!plant || frozen}
              className="h-11 px-5 rounded-full bg-emerald-600 text-sm disabled:opacity-40"
            >
              Run W(B,y)
            </button>
            <Link
              href="/audit"
              className="h-11 px-5 rounded-full border border-zinc-700 text-sm inline-flex items-center"
            >
              Open review desk
            </Link>
          </div>
          {audit ? (
            <p className="text-xs text-amber-400 mt-4 break-all">
              FROZEN digest {audit.digest_sha256}
            </p>
          ) : null}
          <p className="text-xs text-zinc-500 mt-4">
            Limitation: evidence gate only. Does not emit a diagnosis, does not
            eliminate misdiagnosis, makes no device claim. No production PHI.
          </p>
        </section>

        {plant && plant.M.ledger.length > 0 ? (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-8 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500">
                  <th className="text-left py-2">t</th>
                  <th className="text-left py-2">y</th>
                  <th className="text-left py-2">e→</th>
                  <th className="text-left py-2">Δ</th>
                  <th className="text-left py-2">gate</th>
                </tr>
              </thead>
              <tbody>
                {plant.M.ledger.map((s) => (
                  <tr key={`${s.t}-${s.y}`} className="border-t border-zinc-800">
                    <td className="py-2">{s.t}</td>
                    <td className="py-2">{s.y}</td>
                    <td className="py-2">
                      {s.e}→{s.e_next}
                    </td>
                    <td className="py-2">{s.reduced}</td>
                    <td className="py-2">{s.gate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/">
            Music home
          </Link>
          <Link className="underline" href="/workbench">
            Outcome Engine
          </Link>
          <Link className="underline" href="/marketplace">
            Marketplace
          </Link>
        </nav>
      </main>
    </div>
  );
}
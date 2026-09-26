"use client";

import { useEffect, useState } from "react";
import { ACTIONS_1D, QUALITY_ACTIONS, StepRecord } from "@/lib/types";
import { Plant } from "@/lib/loop";

type Payload = { plant: Plant; rec?: StepRecord };

export default function WorkspacePage() {
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(body: object) {
    setBusy(true);
    const res = await fetch("/api/step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setData(await res.json());
    setBusy(false);
  }

  useEffect(() => {
    call({ op: "snapshot" });
  }, []);

  const plant = data?.plant;
  const rows = plant?.M.ledger || [];

  return (
    <main>
      <h1>Workspace A</h1>
      <p className="lead">
        Controller. Task, policy, evaluator, memory, Self(). After explore,
        do not type y.
      </p>

      <div className="card">
        <div className="row">
          <button className="primary" disabled={busy} onClick={() => call({ op: "step" })}>
            A steps (no operator y)
          </button>
          <button disabled={busy} onClick={() => call({ op: "demo" })}>
            Run 1-D demonstration
          </button>
          <button disabled={busy} onClick={() => call({ op: "reset", mode: "scalar" })}>
            Reset scalar B₀=100
          </button>
          <button disabled={busy} onClick={() => call({ op: "reset", mode: "quality" })}>
            Reset quality B
          </button>
        </div>
        <p className="mono">
          t={plant?.t ?? "—"} mode={plant?.mode} last_z={plant?.M.last_z ?? "—"}
        </p>
      </div>

      <div className="card">
        <h2>Operator explore only</h2>
        <div className="row">
          {(plant?.mode === "quality" ? QUALITY_ACTIONS : ACTIONS_1D).map((a) => (
            <button
              key={String(a)}
              disabled={busy}
              onClick={() => call({ op: "step", y: String(a) })}
            >
              y={String(a)}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Ledger</h2>
        <table>
          <thead>
            <tr>
              <th>t</th>
              <th>y</th>
              <th>z</th>
              <th>V</th>
              <th>op</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.t}>
                <td>{r.t}</td>
                <td className="mono">{r.y}{r.locked ? " 🔒" : ""}</td>
                <td className="mono">{r.z}</td>
                <td>{r.V}</td>
                <td className={r.operator_chose_action ? "warn" : "ok"}>
                  {String(r.operator_chose_action)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
"use client";

import { useMemo, useState } from "react";
import { caseById, freshPlant, measureE } from "@/lib/closed-loop";
import { phi, projectTriad, rollout, safetyBoard } from "@/lib/triad";

export default function SafetyCognitiveLoop() {
  const board = useMemo(() => safetyBoard(), []);
  const [caseId, setCaseId] = useState(board[0].id);
  const cold = useMemo(() => rollout(caseId, "operator"), [caseId]);
  const cognitive = useMemo(() => rollout(caseId, "grok_fast"), [caseId]);
  const gain = phi(cold.eFinal, cognitive.eFinal);
  const c = caseById(caseId);
  const eNow = measureE(freshPlant(caseId).B, c);

  return (
    <main style={{ fontFamily: "ui-sans-serif, system-ui", padding: 24, maxWidth: 880 }}>
      <p>Shiyan — one loop</p>
      <h1>Safety plant, one axis</h1>
      <p>
        Evidence gate. Not a diagnosis. No PHI. Buyers pay for Φ &gt; 0, not for generated text.
      </p>
      <p>
        e(B, c) = distance to the reference pack + 0.25 if the gate mismatches.
        Φ = e_cold(final) − e_cognitive(final). Emergent only if Φ &gt; 0.
      </p>
      <label>
        Pack{" "}
        <select value={caseId} onChange={(e) => setCaseId(e.target.value)}>
          {board.map((row) => (
            <option key={row.id} value={row.id}>
              {row.title}
            </option>
          ))}
        </select>
      </label>
      <p>
        reference {c.reference_gate} · e now {eNow} · cold {cold.eFinal} · cognitive{" "}
        {cognitive.eFinal} · Φ {gain} · {gain > 0 ? "error win" : "not listable"}
      </p>
      <table cellPadding={6}>
        <thead>
          <tr>
            <th>t</th>
            <th>y</th>
            <th>B = e</th>
            <th>z = e_next</th>
            <th>A on same axis</th>
            <th>Δ</th>
          </tr>
        </thead>
        <tbody>
          {cold.ledger.map((rec) => {
            const triad = projectTriad(rec);
            return (
              <tr key={rec.t}>
                <td>{rec.t}</td>
                <td>{rec.y}</td>
                <td>{triad.B}</td>
                <td>{triad.Z}</td>
                <td>{triad.A}</td>
                <td>{triad.delta}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <h2>Board</h2>
      <ul>
        {board.map((row) => (
          <li key={row.id}>
            {row.title}: Φ {row.phi} — {row.note}
          </li>
        ))}
      </ul>
    </main>
  );
}
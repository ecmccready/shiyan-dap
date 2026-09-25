"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Cycle = {
  cycle: number;
  state: number;
  prediction: number;
  action: number;
  result: number;
  z: number;
  next_self: string;
};

type Snap = {
  inited: boolean;
  A: string;
  B: number;
  z: number;
  cycles: Cycle[];
  policy0: number | null;
  policy_now?: { action: number; source: string };
  experience_changed_policy: boolean;
  operator_chose_action: boolean;
};

export default function WorkspacePage() {
  const [data, setData] = useState<Snap | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(body: object) {
    setBusy(true);
    const res = await fetch("/api/workspace/proof", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setData(await res.json());
    setBusy(false);
  }

  useEffect(() => {
    fetch("/api/workspace/proof")
      .then((r) => r.json())
      .then(setData);
  }, []);

  return (
    <main className="min-h-screen bg-black text-zinc-100 p-8 max-w-3xl mx-auto space-y-6">
      <p className="text-xs uppercase tracking-widest text-emerald-400">
        Proof · does experience change the next policy?
      </p>
      <h1 className="text-2xl font-semibold">Workspace A</h1>
      <p className="text-sm text-zinc-400">
        Not “can an LLM produce an answer?” A acts on B, measures z,
        writes E, Self() uses E, A selects the next y. Goal: |B| from
        100 toward 0. Actions {"{+10,+5,−5,−10}"}. After Initialize,
        the operator does not pick the action.
      </p>
      <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-auto">
        {`A(M,B) → y → B'=W(B,y) → z=|B'| → Self(M⊕z,B') → y'
probe policy at B=100 before E vs after E`}
      </pre>

      <div className="flex flex-wrap gap-4 text-sm">
        <button
          type="button"
          disabled={busy}
          className="underline disabled:opacity-50"
          onClick={() => call({ reset: true })}
        >
          Initialize A and B
        </button>
        <button
          type="button"
          disabled={busy}
          className="underline disabled:opacity-50"
          onClick={() => call({ run: true, n: 12 })}
        >
          Run 12 cycles
        </button>
        <button
          type="button"
          disabled={busy}
          className="underline disabled:opacity-50"
          onClick={() => call({})}
        >
          One cycle
        </button>
      </div>

      {data && (
        <section className="text-xs font-mono space-y-2">
          <p>
            question: Does experience change the next policy?
            <br />
            {data.A} B={data.B} z={data.z}
            <br />
            policy0={String(data.policy0)} policy_now=
            {data.policy_now?.action} ({data.policy_now?.source})
            <br />
            experience_changed_policy=
            {String(data.experience_changed_policy)} operator_chose_action=
            {String(data.operator_chose_action)}
          </p>
          <div className="overflow-x-auto border border-zinc-800 rounded-lg">
            <table className="w-full text-left">
              <thead className="text-emerald-400">
                <tr>
                  <th className="p-2">Cycle</th>
                  <th className="p-2">A prediction</th>
                  <th className="p-2">Action</th>
                  <th className="p-2">B state</th>
                  <th className="p-2">z</th>
                  <th className="p-2">Next A</th>
                </tr>
              </thead>
              <tbody>
                {(data.cycles || []).map((c) => (
                  <tr key={c.cycle} className="border-t border-zinc-800">
                    <td className="p-2">{c.cycle}</td>
                    <td className="p-2">{c.prediction}</td>
                    <td className="p-2">{c.action}</td>
                    <td className="p-2">{c.result}</td>
                    <td className="p-2">{c.z}</td>
                    <td className="p-2">{c.next_self}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <nav className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/workbench">
          Workbench B
        </Link>
        <Link className="underline" href="/api/workspace/proof">
          JSON log
        </Link>
        <Link className="underline" href="/">
          Home
        </Link>
      </nav>
    </main>
  );
}
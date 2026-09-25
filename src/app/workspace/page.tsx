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
  A: string;
  B: number;
  z: number;
  cycles: Cycle[];
  policy0: number | null;
  policy_now?: { action: number; source: string };
  experience_changed_policy?: boolean;
  operator_chose_action?: boolean;
  z_now?: number;
  z_if_policy0?: number;
  different_because_E?: boolean;
  better_because_E?: boolean;
  milestone?: string;
  pass?: number;
  trials?: number;
  rate?: number;
  toward_demonstrated_autonomous_ai?: boolean;
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
        Milestone · Aₜ₊₁ different/better because of E,z
      </p>
      <h1 className="text-2xl font-semibold">Workspace A</h1>
      <p className="text-sm text-zinc-400">
        You initialize. After that A selects y. Compare actual |B|
        to the same number of steps frozen at policy0. If policy
        changes and |B| is lower than that freeze, Aₜ₊₁ is
        measurably different and better because of E and z.
      </p>

      <div className="flex flex-wrap gap-4 text-sm">
        <button type="button" disabled={busy} className="underline disabled:opacity-50" onClick={() => call({ reset: true })}>
          Initialize
        </button>
        <button type="button" disabled={busy} className="underline disabled:opacity-50" onClick={() => call({ run: true, n: 12 })}>
          Run 12
        </button>
        <button type="button" disabled={busy} className="underline disabled:opacity-50" onClick={() => call({ experiment: true, trials: 5, n: 12 })}>
          Repeat 5×
        </button>
      </div>

      {data && (
        <section className="text-xs font-mono space-y-2">
          <p>
            {data.A} B={data.B} z={data.z}
            <br />
            policy0={String(data.policy0)} now={data.policy_now?.action}{" "}
            ({data.policy_now?.source})
            <br />
            z_now={data.z_now ?? data.z} z_if_policy0={String(data.z_if_policy0)}
            <br />
            different_because_E={String(data.different_because_E)} better_because_E=
            {String(data.better_because_E)}
            <br />
            {data.trials != null && (
              <>
                pass={data.pass}/{data.trials} rate={data.rate} toward=
                {String(data.toward_demonstrated_autonomous_ai)}
                <br />
              </>
            )}
            {data.milestone}
          </p>
          <div className="overflow-x-auto border border-zinc-800 rounded-lg">
            <table className="w-full text-left">
              <thead className="text-emerald-400">
                <tr>
                  <th className="p-2">Cycle</th>
                  <th className="p-2">Pred</th>
                  <th className="p-2">y</th>
                  <th className="p-2">B</th>
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
          B
        </Link>
        <Link className="underline" href="/api/workspace/proof">
          JSON
        </Link>
        <Link className="underline" href="/">
          Home
        </Link>
      </nav>
    </main>
  );
}
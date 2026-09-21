"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Row = {
  weight: number;
  error: number | null;
  z: string;
  next_action: string;
  channelId: string;
  external_event: { authoritative: boolean; price: number | null };
  at: string;
};

export default function WorkspacePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/workspace/state");
    const data = await res.json();
    setRows(data.rows || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function run(external: boolean) {
    setBusy(true);
    await fetch("/api/workspace/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        external,
        scale: 0.72,
        time: 0.81,
        speed: 0.64,
        confidence: 0.9,
      }),
    });
    await load();
    setBusy(false);
  }

  return (
    <main className="min-h-screen bg-black text-zinc-100 p-8 max-w-2xl mx-auto space-y-8">
      <p className="text-xs uppercase tracking-widest text-emerald-400">
        Workspace · $10 container · $1 calibrates B
      </p>
      <h1 className="text-2xl font-semibold">Workspace</h1>
      <p className="text-sm text-zinc-400">
        Predict the transition. If an external B exists, it is
        authoritative. Measure the error. z names the next action.
        Founder click is still A. Independent $1 is not yet live.
      </p>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="border border-zinc-800 rounded-lg p-4 space-y-2">
          <p className="text-xs text-emerald-400">Endogenous</p>
          <p className="text-lg">$10 / month room</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(false)}
            className="text-sm underline disabled:opacity-50"
          >
            Compute provisional B
          </button>
        </div>
        <div className="border border-emerald-800 rounded-lg p-4 space-y-2">
          <p className="text-xs text-emerald-400">Exogenous</p>
          <p className="text-lg">Buy as B · $1</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(true)}
            className="text-sm underline disabled:opacity-50"
          >
            Record calibration intent
          </button>
          <div>
            <Link className="text-sm underline" href="/offer">
              Pay $1 on offer
            </Link>
          </div>
        </div>
      </section>

      <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-auto">
        {`B_pred = f(S, T, V, C)
E_B    = B_observed - B_pred
S scale · T time · V speed · C ledger confidence

if (externalB.exists) B = observed; z = measure(pred, B)
else                  B = endogenous; z = provisional`}
      </pre>

      <section>
        <h2 className="text-sm text-emerald-400 mb-2">
          Ledger (memory, this instance)
        </h2>
        {rows.length === 0 ? (
          <p className="text-xs text-zinc-500">
            No rows yet. Compute or calibrate.
          </p>
        ) : (
          <ul className="space-y-2 text-xs">
            {rows.map((r) => (
              <li
                key={r.at}
                className="border border-zinc-800 rounded-lg p-3 font-mono"
              >
                {r.at} · {r.channelId} · w={r.weight} · E_B=
                {r.error ?? "n/a"} · {r.next_action}
                <br />
                {r.z}
                {r.external_event.authoritative ? " · external" : " · endogenous"}
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/offer">
          Offer
        </Link>
        <Link className="underline" href="/proof">
          Proof
        </Link>
        <Link className="underline" href="/loop">
          Loop
        </Link>
        <Link className="underline" href="/validation">
          Validate
        </Link>
      </nav>
    </main>
  );
}
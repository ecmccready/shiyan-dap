"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { recordOutcome, yFromAsset, computeB, Self, readOutcomes } from "@/lib/outcomes";
import { readPings, writePings, type PingRecord } from "@/lib/ping";

export default function PingPage() {
  const [rows, setRows] = useState<PingRecord[]>([]);
  const [url, setUrl] = useState("");
  const [z, setZ] = useState("");
  const [b, setB] = useState("");

  const refresh = () => {
    setRows(readPings());
    setZ(Self(readOutcomes()).z);
    setB(computeB(readOutcomes()).action);
  };

  useEffect(() => {
    refresh();
  }, []);

  const create = async () => {
    const res = await fetch("/api/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset_id: "ping_ref" }),
    });
    const data = await res.json();
    if (!data.ok) return;
    const receive = window.location.origin + data.receive_url;
    setUrl(receive);
    const listed = yFromAsset("listed");
    recordOutcome({
      asset_id: data.ping.ping_id,
      action: "PING_OPEN",
      y_before: listed,
      y_after: listed,
      vertical: "music",
      agent: "Ping Reference",
      simulated: false,
    });
    writePings([data.ping, ...readPings()]);
    refresh();
  };

  const poll = async (id: string) => {
    const res = await fetch("/api/ping/" + id);
    const data = await res.json();
    if (data.observed === 1) {
      const before = yFromAsset("listed");
      const after = { ...before, audience_response: 1 as const };
      recordOutcome({
        asset_id: id,
        action: "PING_RECEIVED",
        y_before: before,
        y_after: after,
        vertical: "music",
        agent: "Ping Reference",
        simulated: false,
      });
      writePings(
        readPings().map((row) =>
          row.ping_id === id ? { ...row, observed: 1, received_at: data.timestamp } : row
        )
      );
    }
    refresh();
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Ping" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">slice_v10 · external event detection · not Level 3</p>
        <h1 className="text-3xl font-bold mb-3">Ping Reference</h1>
        <p className="text-zinc-400 mb-8">
          Create a reference. Open it from another tab or phone. Shiyan does not decide that the ping happened. The request arriving does. Settlement stays 0. computeB() names the next B after Learn reads the row.
        </p>

        <section className="bg-zinc-900/60 border border-emerald-800 rounded-2xl p-6 mb-6">
          <p className="text-xs text-emerald-400 mb-2">Self() · computeB()</p>
          <p className="text-xl">{z || "Observe."}</p>
          <p className="text-zinc-500 mt-2">Computed B {b} · level3 false</p>
        </section>

        <div className="flex flex-wrap gap-3 mb-6">
          <button onClick={create} className="h-11 px-6 rounded-full bg-emerald-600 text-sm">
            Create ping
          </button>
          <Link href="/measurements" className="h-11 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center">
            Learn
          </Link>
        </div>

        {url ? (
          <p className="text-sm text-emerald-400 mb-6 break-all">
            Open this from outside this tab: {url}
          </p>
        ) : null}

        <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-8">
          {rows.length === 0 ? (
            <p className="text-zinc-500 text-sm">No references. Absent ping is observed 0.</p>
          ) : (
            rows.map((row) => (
              <div key={row.ping_id} className="mb-4">
                <p className="text-sm">
                  {row.ping_id} · observed {row.observed}
                </p>
                <button
                  onClick={() => poll(row.ping_id)}
                  className="mt-2 h-9 px-4 rounded-full border border-zinc-600 text-xs"
                >
                  Read observation
                </button>
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { computeB, Self, recordOutcome, readOutcomes, yFromAsset } from "@/lib/outcomes";
import { readTrades, writeTrades, type TradeRecord } from "@/lib/trade";

export default function TradePage() {
  const [rows, setRows] = useState<TradeRecord[]>([]);
  const [offer, setOffer] = useState("LIST_INTENT");
  const [z, setZ] = useState("");
  const [b, setB] = useState("");
  const [acceptUrl, setAcceptUrl] = useState("");

  const refresh = () => {
    setRows(readTrades());
    setZ(Self(readOutcomes()).z);
    setB(computeB(readOutcomes()).action);
  };

  useEffect(() => {
    refresh();
  }, []);

  const create = async () => {
    const res = await fetch("/api/trade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset_id: "trade_ref", offer }),
    });
    const data = await res.json();
    if (!data.ok) return;
    const listed = yFromAsset("listed");
    recordOutcome({
      asset_id: data.trade.trade_id,
      action: "TRADE_OFFER",
      y_before: listed,
      y_after: listed,
      vertical: "music",
      agent: "Agent A · ECMcCready",
      simulated: false,
    });
    writeTrades([data.trade, ...readTrades()]);
    setAcceptUrl(window.location.origin + data.accept_url);
    refresh();
  };

  const close = async (id: string, move: "accept" | "reject" | "timeout") => {
    const res = await fetch("/api/trade/" + id + "/" + move);
    const data = await res.json();
    if (!data.ok) return;
    const before = yFromAsset("listed");
    const after = {
      ...before,
      acquisition: data.observed === 1 ? (1 as const) : (0 as const),
    };
    recordOutcome({
      asset_id: id,
      action: "TRADE_" + String(data.state).toUpperCase(),
      y_before: before,
      y_after: after,
      vertical: "music",
      agent: move === "accept" ? "Controlled B · session" : "Ping Reference",
      simulated: false,
    });
    if (move === "accept") {
      await fetch("/api/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset_id: id }),
      }).catch(() => {});
    }
    writeTrades(
      readTrades().map((row) =>
        row.trade_id === id
          ? { ...row, state: data.state, observed: data.observed, closed_at: new Date().toISOString() }
          : row
      )
    );
    refresh();
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Trade" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">slice_v11 · P2P primitive · not a marketplace</p>
        <h1 className="text-3xl font-bold mb-3">A offers. B closes.</h1>
        <p className="text-zinc-400 mb-8">
          Accept is 1. Reject is 0. Timeout is Hold. Ping can confirm later. Settlement stays off this page. Songs are not for sale here.
        </p>

        <section className="bg-zinc-900/60 border border-emerald-800 rounded-2xl p-6 mb-6">
          <p className="text-xs text-emerald-400 mb-2">Self() · computeB()</p>
          <p className="text-xl">{z || "Observe."}</p>
          <p className="text-zinc-500 mt-2">Computed B {b} · level3 false</p>
        </section>

        <div className="flex flex-wrap gap-3 mb-6">
          <input
            value={offer}
            onChange={(e) => setOffer(e.target.value)}
            className="h-11 px-4 rounded-full bg-zinc-950 border border-zinc-700"
          />
          <button onClick={create} className="h-11 px-6 rounded-full bg-emerald-600 text-sm">
            Offer
          </button>
          <Link href="/ping" className="h-11 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center">
            Ping
          </Link>
          <Link href="/marketplace" className="h-11 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center">
            Marketplace
          </Link>
        </div>

        {acceptUrl ? <p className="text-sm text-emerald-400 mb-6 break-all">Accept URL · {acceptUrl}</p> : null}

        <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-8">
          {rows.length === 0 ? (
            <p className="text-zinc-500 text-sm">No offers. Timeout is still Hold.</p>
          ) : (
            rows.map((row) => (
              <div key={row.trade_id} className="mb-5">
                <p className="text-sm">
                  {row.trade_id} · {row.offer} · {row.state} · observed {row.observed}
                </p>
                {row.state === "offered" ? (
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button onClick={() => close(row.trade_id, "accept")} className="h-9 px-4 rounded-full bg-emerald-600 text-xs">
                      Accept
                    </button>
                    <button onClick={() => close(row.trade_id, "reject")} className="h-9 px-4 rounded-full border border-zinc-600 text-xs">
                      Reject
                    </button>
                    <button onClick={() => close(row.trade_id, "timeout")} className="h-9 px-4 rounded-full border border-zinc-600 text-xs">
                      Timeout
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
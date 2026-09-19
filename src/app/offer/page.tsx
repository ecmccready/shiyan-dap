"use client";

import { useState } from "react";
import Link from "next/link";

const OFFER = {
  offerId: "OFFER-shiyan-yishu-001",
  workspaceId: "WS-founder",
  channelId: "CH-b",
  assetId: "cl_shiyan_yishu_001",
  title: "Shiyan Yishu — First Single",
  priceUsd: 1,
  phase: "OFFER",
};

export default function OfferPage() {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function buyIndependent() {
    setErr("");
    setBusy(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: OFFER.assetId,
          title: OFFER.title,
          cluster: "B",
          offerId: OFFER.offerId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "checkout failed");
      }
      window.location.href = data.url;
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "checkout failed");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-zinc-100 p-8 max-w-2xl mx-auto space-y-6">
      <p className="text-xs uppercase tracking-widest text-emerald-400">
        Commercial object · no fake $1
      </p>
      <h1 className="text-2xl font-semibold">Offer</h1>
      <p className="text-sm text-zinc-400">
        This page names an offer. Stripe Checkout is external. Returning
        with a query string does not settle Shiyan state.
      </p>

      <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-auto">
        {`OFFER
  offerId       ${OFFER.offerId}
  workspaceId   ${OFFER.workspaceId}
  channelId     ${OFFER.channelId}
  assetId       ${OFFER.assetId}
  price         $${OFFER.priceUsd}
  phase         ${OFFER.phase}

TRANSACTION     (Stripe Checkout — external)
EXTERNAL EVENT  (webhook → /ping observed 1)
MEASUREMENT     (Learn)
z`}
      </pre>

      <button
        type="button"
        onClick={buyIndependent}
        disabled={busy}
        className="px-4 py-2 rounded-md bg-emerald-600 text-black text-sm font-medium disabled:opacity-50"
      >
        {busy ? "Opening Stripe…" : "Buy as B · $1"}
      </button>

      {err ? <p className="text-sm text-red-400">{err}</p> : null}

      <p className="text-xs text-zinc-500">
        Use another email and browser. Same person is still A. Live rail
        remains <Link className="underline" href="/nfts">/nfts</Link>.
        Observation is{" "}
        <Link className="underline" href="/api/stripe/webhook">
          /api/stripe/webhook
        </Link>
        , not this page.
      </p>
    </main>
  );
}
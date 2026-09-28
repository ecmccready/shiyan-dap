"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import RailLinks from "@/components/RailLinks";
import { LedgerAsset, applyEvent, readLedger } from "@/lib/ledger";
import { listCurrentE, readEListings, readPersistedPlant, ErrorListing } from "@/lib/closed-loop";

export default function MarketPage() {
  const [assets, setAssets] = useState<LedgerAsset[]>([]);

  useEffect(() => {
    setAssets(readLedger());
  }, []);

  const list = (id: string) => {
    applyEvent(id, "LIST");
    setAssets(readLedger());
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Market" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">e is what lists</p>
        <h1 className="text-3xl font-bold mb-3">Marketplace</h1>
        <p className="text-zinc-400 mb-8">
          The loop lists error against a reference label. Music assets still
          live on the same rail. B is not the buyer here — B is the plant
          that produced e.
        </p>
        <ErrorRail />

        <div className="mb-8">
          <RailLinks />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {assets.map((asset) => (
            <div key={asset.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
              <p className="text-xs text-emerald-400 mb-2">{asset.founder ? "User A · founder" : "User B · creator"}</p>
              <h2 className="text-lg font-semibold mb-2">{asset.title}</h2>
              <p className="text-sm text-zinc-500 mb-1">Owner {asset.owner}</p>
              <p className="text-sm text-zinc-500 mb-4">State {asset.state}</p>
              {asset.state === "unlisted" || asset.state === "cancelled" ? (
                <button onClick={() => list(asset.id)} className="h-11 px-5 rounded-full bg-emerald-600 text-sm">
                  LIST
                </button>
              ) : (
                <Link href="/nfts" className="h-11 px-5 rounded-full border border-zinc-700 text-sm inline-flex items-center">
                  Prove
                </Link>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
function ErrorRail() {
  const [items, setItems] = useState<ErrorListing[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    setItems(readEListings());
  }, []);

  const list = () => {
    const plant = readPersistedPlant();
    if (!plant || !plant.M.last_z) {
      setNote("Run the loop first. Nothing to list until z is measured.");
      return;
    }
    listCurrentE(plant);
    setItems(readEListings());
    setNote(`Listed e=${plant.M.last_e} from ${plant.case_id}.`);
  };

  return (
    <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-8">
      <p className="text-xs text-emerald-400 mb-2">Error listings</p>
      <p className="text-sm text-zinc-400 mb-4">
        e versus the reference gate. This is the object the marketplace can
        carry. Not an LLM paragraph.
      </p>
      <button onClick={list} className="h-11 px-5 rounded-full bg-emerald-600 text-sm mb-4">
        List current e
      </button>
      {note ? <p className="text-sm text-zinc-300 mb-4">{note}</p> : null}
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-zinc-500">No e listed yet.</p>
        ) : (
          items.map((it) => (
            <p key={it.id} className="text-sm text-zinc-300 font-mono">
              {it.case_id} · e={it.e} · gate={it.gate} · y={it.y} · t={it.t}
            </p>
          ))
        )}
      </div>
    </section>
  );
}

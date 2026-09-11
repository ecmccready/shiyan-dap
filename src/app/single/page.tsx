"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import RailLinks from "@/components/RailLinks";
import { LedgerAsset, readLedger } from "@/lib/ledger";

export default function SongsPage() {
  const [asset, setAsset] = useState<LedgerAsset | null>(null);

  useEffect(() => {
    setAsset(readLedger()[0] || null);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Release" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">SHOW</p>
        <h1 className="text-3xl font-bold mb-3">Songs</h1>
        <p className="text-zinc-400 mb-8">First Single is the public proof. Listen lives at ecmccready.com/songs.</p>
        <div className="mb-8">
          <RailLinks />
        </div>
        {asset && (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
            <p className="text-xs text-emerald-400 mb-2">User A · {asset.creator}</p>
            <h2 className="text-xl font-semibold mb-3">{asset.title}</h2>
            <p className="text-sm text-zinc-500 mb-6">State {asset.state}</p>
            <div className="flex flex-wrap gap-2">
              <a href="http://ecmccready.com/songs" className="h-11 px-6 rounded-full bg-emerald-600 text-sm inline-flex items-center">
                Play
              </a>
              <Link href="/nfts" className="h-11 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center">
                Acquire
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
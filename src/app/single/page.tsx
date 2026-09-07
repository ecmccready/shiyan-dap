"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
export default function SinglePackagePage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch("/api/agent?domain=music-video&path=fast")
      .then((res) => res.json())
      .then(setData)
      .catch(() => {});
  }, []);
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="05 Release" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">Protocol 05</p>
        <h1 className="text-4xl font-bold mb-4">Shiyan Yishu — First Single</h1>
        <p className="text-zinc-400 text-lg max-w-2xl mb-10">Move the work into the world. The single can sell before the master exists.</p>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-8 mb-8">
          <p className="text-sm text-emerald-400 mb-2">Live cluster</p>
          <p className="text-xl font-semibold">{data?.cluster?.name || "Shiyan Yishu"}</p>
          <p className="text-sm text-zinc-400 mt-2">Owner: {data?.artist || "ECMcCready"}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/nfts" className="h-11 px-6 rounded-full bg-emerald-600 text-white text-sm font-medium inline-flex items-center">04 Prove</Link>
          <Link href="/marketplace" className="h-11 px-6 rounded-full bg-zinc-800 text-white text-sm font-medium inline-flex items-center">Market</Link>
          <Link href="/measurements" className="h-11 px-6 rounded-full border border-zinc-700 text-zinc-300 text-sm font-medium inline-flex items-center">06 Measure</Link>
        </div>
      </main>
    </div>
  );
}

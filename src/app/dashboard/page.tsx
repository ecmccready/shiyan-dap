"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/agent?domain=music&path=deep")
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);
  if (loading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center"><p className="text-zinc-400">Loading agentic memory…</p></div>;
  }
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="07 Learn" />
      <main className="max-w-6xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">Protocol 07</p>
        <h1 className="text-3xl font-bold mb-2">Learn, then next move</h1>
        <p className="text-zinc-400 mb-10">Shiyan records what happened and uses it to determine the next best action.</p>
        <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-2xl p-8 mb-8">
          <p className="text-sm text-emerald-400 mb-3">Memory signal</p>
          <p className="text-4xl font-bold">πinv = {data?.pi_inv ?? "—"}</p>
          <p className="text-zinc-400 mt-2">Path: {data?.model?.path || "—"}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/home" className="h-11 px-6 rounded-full bg-emerald-600 text-white text-sm font-medium inline-flex items-center">Next action in Assist</Link>
          <Link href="/bot" className="h-11 px-6 rounded-full border border-zinc-700 text-zinc-300 text-sm font-medium inline-flex items-center">Execute in Grok Bot</Link>
        </div>
      </main>
    </div>
  );
}

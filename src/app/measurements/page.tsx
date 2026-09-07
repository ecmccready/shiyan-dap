"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
export default function MeasurementsPage() {
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
    return <div className="min-h-screen bg-black text-white flex items-center justify-center"><p className="text-zinc-400">Loading measurements…</p></div>;
  }
  const metrics = data?.self_improvement || {};
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="06 Measure" />
      <main className="max-w-6xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">Protocol 06</p>
        <h1 className="text-3xl font-bold mb-2">Measure the result</h1>
        <p className="text-zinc-400 mb-10">Capture audience response, then send it into memory.</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-10">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6"><p className="text-sm text-zinc-400">Outcomes</p><p className="text-2xl font-semibold">{metrics.count ?? 0}</p></div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6"><p className="text-sm text-zinc-400">Path</p><p className="text-2xl font-semibold">{data?.model?.path || "—"}</p></div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6"><p className="text-sm text-zinc-400">z</p><p className="text-2xl font-semibold">{data?.emergence?.z ?? "—"}</p></div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6"><p className="text-sm text-zinc-400">Domain</p><p className="text-2xl font-semibold">{data?.domain || "music"}</p></div>
        </div>
        <Link href="/dashboard" className="h-11 px-6 rounded-full bg-emerald-600 text-white text-sm font-medium inline-flex items-center">07 Learn from this →</Link>
      </main>
    </div>
  );
}

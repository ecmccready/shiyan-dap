"use client";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import RailLinks from "@/components/RailLinks";

export default function SinglePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Release" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">Songs</p>
        <h1 className="text-3xl font-bold mb-3">Shiyan Yishu — First Single</h1>
        <p className="text-zinc-400 mb-8 max-w-3xl">
          Release surface. The single can sell before the master exists. Guitar Pro and Cubase can attach later.
        </p>
        <div className="mb-10">
          <RailLinks />
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-8">
          <p className="text-xs text-emerald-400 mb-2">Founder proof</p>
          <h2 className="text-xl font-semibold mb-4">Shiyan Yishu</h2>
          <p className="text-sm text-zinc-400 mb-1">Asset ID cl_shiyan_yishu_001</p>
          <p className="text-sm text-zinc-400 mb-1">Creator ECMcCready</p>
          <p className="text-sm text-zinc-400 mb-1">Owner ECMcCready</p>
          <p className="text-sm text-zinc-400 mb-5">Status production available</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/nfts" className="h-10 px-5 rounded-full bg-emerald-600 text-white text-sm inline-flex items-center">Acquire</Link>
            <Link href="/marketplace" className="h-10 px-5 rounded-full border border-zinc-700 text-sm inline-flex items-center">Marketplace</Link>
            <Link href="/playlist" className="h-10 px-5 rounded-full border border-zinc-700 text-sm inline-flex items-center">Playlist</Link>
            <a href="https://ecmccready.com/songs" target="_blank" rel="noreferrer" className="h-10 px-5 rounded-full border border-zinc-700 text-sm inline-flex items-center">Listen</a>
          </div>
        </div>
        <Link href="/upload" className="text-sm text-zinc-500">Open another project</Link>
      </main>
    </div>
  );
}
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { FIRST_SINGLE_URL, proofSingle, proofPlaylist } from "@/lib/proof-catalog";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-6 pt-16 pb-20">
        <p className="text-xs tracking-[0.28em] uppercase text-emerald-400 mb-5">Shiyan AI Assist</p>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] max-w-5xl">
          Create. Assist. Prove.
          <br />
          Release. Learn.
        </h1>
        <p className="text-zinc-300 text-lg md:text-xl max-w-4xl mt-8 leading-relaxed">
          I am using my first single "Shiyan Yishu" to build and prove Shiyan AI Assist —
          the AI system that helps an independent creator take a creation to release,
          audience response, and the next best action.
        </p>
        <p className="text-zinc-500 mt-4 max-w-3xl">
          Class: the protocol we already built. Pivot: the public statement. Function: emergent technology.
          y,x + y,x = z. When y(x) == 1 the First Single is the proof.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/home" className="h-12 px-7 rounded-full bg-emerald-600 text-white text-sm font-medium inline-flex items-center">C2C Assist</Link>
          <Link href="/upload" className="h-12 px-7 rounded-full border border-zinc-700 text-zinc-300 text-sm font-medium inline-flex items-center">Upload</Link>
          <Link href="/marketplace" className="h-12 px-7 rounded-full border border-zinc-700 text-zinc-300 text-sm font-medium inline-flex items-center">B2B Marketplace</Link>
          <Link href="/playlist" className="h-12 px-7 rounded-full border border-zinc-700 text-zinc-300 text-sm font-medium inline-flex items-center">B2B Playlist</Link>
          <a href={FIRST_SINGLE_URL} target="_blank" rel="noreferrer" className="h-12 px-7 rounded-full border border-emerald-800 text-emerald-300 text-sm font-medium inline-flex items-center">Listen to Shiyan Yishu</a>
        </div>
        <section className="mt-16 grid md:grid-cols-2 gap-5">
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-7">
            <p className="text-xs text-emerald-400 mb-2">PROOF · FIRST SINGLE</p>
            <h2 className="text-2xl font-semibold mb-2">{proofSingle.name}</h2>
            <p className="text-sm text-zinc-400 mb-4">Owner {proofSingle.owner} · {proofSingle.status}</p>
            <p className="text-sm text-zinc-500 mb-5">Every song + story becomes an owned digital asset. Music is the wedge.</p>
            <Link href="/single" className="text-sm text-emerald-400">Open package</Link>
          </article>
          <article className="rounded-2xl border border-amber-900/40 bg-zinc-900/40 p-7">
            <p className="text-xs text-amber-400 mb-2">B2B · PLAYLIST RAIL</p>
            <h2 className="text-2xl font-semibold mb-2">{proofPlaylist.name}</h2>
            <p className="text-sm text-zinc-400 mb-4">{proofPlaylist.license} · ready</p>
            <p className="text-sm text-zinc-500 mb-5">Marketplace retains. Playlist transfers. Grok Bot executes.</p>
            <Link href="/playlist" className="text-sm text-amber-400">License playlist</Link>
          </article>
        </section>
      </main>
    </div>
  );
}

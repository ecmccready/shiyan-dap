import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import RailLinks from "@/components/RailLinks";

export default function TokensPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Prove" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">Generative Transform Protocol</p>
        <h1 className="text-3xl font-bold mb-3">Tokenize Everything</h1>
        <p className="text-zinc-400 mb-8 max-w-3xl">
          Wrap a creation as a ledger asset. Acquire it. Transfer it. Music is first. On-chain mint comes after a paid buyer.
        </p>
        <div className="mb-10">
          <RailLinks />
        </div>
        <div className="space-y-4 mb-10">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
            <p className="text-xs text-zinc-500 mb-2">1. Ingest and wrap</p>
            <p>Upload a song, MIDI, stem, or no file yet. Get an asset ID.</p>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
            <p className="text-xs text-zinc-500 mb-2">2. Prove</p>
            <p>The ledger on /nfts is the record. One click acquires it.</p>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
            <p className="text-xs text-zinc-500 mb-2">3. Mint later</p>
            <p>ERC-721 / ERC-1155 / SPL wait until there is a paid buyer. Fiat first.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/nfts" className="h-11 px-6 rounded-full bg-emerald-600 text-white text-sm inline-flex items-center">Open ledger</Link>
          <Link href="/upload" className="h-11 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center">Upload</Link>
        </div>
      </main>
    </div>
  );
}
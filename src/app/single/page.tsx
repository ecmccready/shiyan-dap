"use client";

import Link from "next/link";

export default function SinglePackagePage() {
  const single = {
    title: "Shiyan Yishu — First Single",
    status: "Pre-production package (sellable now)",
    owner: "ECMcCready",
    domain: "Music / Music Video",
    playlist: "Shiyan Yishu Label Playlist",
    token: "MUSIC",
    price: "Package first. Audio can attach later.",
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800/80">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight text-lg">
              Shiyan Yishu
            </Link>
            <span className="text-zinc-500 text-sm">First Single</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/home" className="text-sm text-zinc-400 hover:text-white">Home</Link>
            <Link href="/playlist" className="text-sm text-zinc-400 hover:text-white">Playlist</Link>
            <Link href="/marketplace" className="text-sm text-zinc-400 hover:text-white">Marketplace</Link>
            <Link href="/tokens" className="text-sm text-zinc-400 hover:text-white">Tokens</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-sm text-emerald-400 mb-3">Launch vehicle</p>
        <h1 className="text-4xl font-bold tracking-tight mb-4">{single.title}</h1>
        <p className="text-zinc-400 mb-10 max-w-2xl">
          The single can sell before the finished track exists. The package is
          the asset: story, ownership, playlist rail, and token.
        </p>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-zinc-500 mb-1">Status</p>
              <p>{single.status}</p>
            </div>
            <div>
              <p className="text-zinc-500 mb-1">Owner</p>
              <p>{single.owner}</p>
            </div>
            <div>
              <p className="text-zinc-500 mb-1">Domain</p>
              <p>{single.domain}</p>
            </div>
            <div>
              <p className="text-zinc-500 mb-1">Playlist rail</p>
              <p>{single.playlist}</p>
            </div>
            <div>
              <p className="text-zinc-500 mb-1">Token</p>
              <p>{single.token}</p>
            </div>
            <div>
              <p className="text-zinc-500 mb-1">Offer</p>
              <p>{single.price}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/home" className="h-11 px-6 rounded-full bg-emerald-600 text-white text-sm font-medium flex items-center">
            Attach input
          </Link>
          <Link href="/playlist" className="h-11 px-6 rounded-full bg-amber-600 text-white text-sm font-medium flex items-center">
            Settle on Playlist
          </Link>
          <Link href="/marketplace" className="h-11 px-6 rounded-full bg-zinc-800 text-white text-sm font-medium flex items-center">
            List in Marketplace
          </Link>
        </div>
      </main>
    </div>
  );
}
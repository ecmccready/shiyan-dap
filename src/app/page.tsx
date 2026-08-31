import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800/80">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-semibold tracking-tight text-lg">
            Shiyan Yishu
          </Link>

          <nav className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Dashboard
            </Link>
            <Link href="/marketplace" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Marketplace
            </Link>
            <Link href="/tokens" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Tokens
            </Link>
            <Link href="/playlist" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Playlist
            </Link>
            <Link href="/nfts" className="text-sm text-zinc-400 hover:text-white transition-colors">
              My NFTs
            </Link>
            <Link href="/bot" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Grok Bot
            </Link>
            <Link href="/home" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Home
            </Link>
            <Link href="/measurements" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Measurements
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">
          Upload your song or AI content.
          <br />
          Keep the ownership.
          <br />
          Get paid.
        </h1>

        <p className="text-zinc-400 text-lg max-w-2xl mx-auto mb-12 leading-relaxed">
          Shiyan Yishu is a decentralized music marketplace and advertising
          engine built for artists and AI creators. It turns every song + story
          — whether human-made or AI-generated — into an owned digital asset
          that can be discovered, clustered, and monetized while the creator
          keeps control of the data and the revenue.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/home"
            className="h-12 px-8 rounded-full bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors flex items-center"
          >
            Enter Social Transmedia
          </Link>
          <Link
            href="/marketplace"
            className="h-12 px-8 rounded-full border border-zinc-700 text-zinc-300 text-sm font-medium hover:border-zinc-500 hover:text-white transition-colors flex items-center"
          >
            View Marketplace
          </Link>
          <Link
            href="/playlist"
            className="h-12 px-8 rounded-full border border-zinc-700 text-zinc-300 text-sm font-medium hover:border-zinc-500 hover:text-white transition-colors flex items-center"
          >
            Open Playlist
          </Link>
        </div>
      </main>
    </div>
  );
}
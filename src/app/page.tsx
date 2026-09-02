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
            <Link href="/home" className="text-sm text-zinc-400 hover:text-white">Home</Link>
            <Link href="/single" className="text-sm text-zinc-400 hover:text-white">Single</Link>
            <Link href="/playlist" className="text-sm text-zinc-400 hover:text-white">Playlist</Link>
            <Link href="/marketplace" className="text-sm text-zinc-400 hover:text-white">Marketplace</Link>
            <Link href="/bot" className="text-sm text-zinc-400 hover:text-white">Grok Bot</Link>
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
          Shiyan Yishu turns every song + story into an owned digital asset.
          Social Transmedia acquires. Marketplace retains. Playlist transfers.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/single" className="h-12 px-8 rounded-full bg-emerald-600 text-white text-sm font-medium flex items-center">
            Open First Single
          </Link>
          <Link href="/home" className="h-12 px-8 rounded-full border border-zinc-700 text-zinc-300 text-sm font-medium flex items-center">
            Submit a story
          </Link>
        </div>
      </main>
    </div>
  );
}
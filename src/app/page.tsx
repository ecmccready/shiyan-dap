import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Navigation */}
      <header className="border-b border-zinc-800/80">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-semibold tracking-tight text-lg">
            Shiyan Yishu
          </span>

          <nav className="flex items-center gap-8">
  <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white transition-colors duration-200">
    Dashboard
  </Link>
  <Link href="/marketplace" className="text-sm text-zinc-400 hover:text-white transition-colors duration-200">
    Marketplace
  </Link>
  <Link href="/tokens" className="text-sm text-zinc-400 hover:text-white transition-colors duration-200">
    Tokens
  </Link>
  <Link href="/nfts" className="text-sm text-zinc-400 hover:text-white transition-colors duration-200">
    My NFTs
  </Link>
  <Link href="/upload" className="text-sm text-zinc-400 hover:text-white transition-colors duration-200">
    Upload
  </Link>
  <Link href="/track/shiyan-yishu" className="text-sm text-zinc-400 hover:text-white transition-colors duration-200">
    Music Track →
  </Link>
  <Link
  href="/measurements"
className="text-sm text-zinc-400 hover:text-white transition-colors duration-200"
>
  Measurements
</Link>
</nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center">
        <div className="max-w-6xl mx-auto px-6 py-24 w-full">
          <div className="max-w-3xl">
            <p className="text-emerald-400 text-sm font-medium mb-5 tracking-wide uppercase">
              Agentic AI × Independent Music
            </p>

            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.1] mb-8">
              Upload your song or AI content.
              <br />
              Keep the ownership.
              <br />
              Get paid.
            </h1>

            <p className="text-lg text-zinc-400 leading-relaxed mb-12 max-w-2xl">
              Shiyan Yishu is a decentralized music marketplace and advertising
              engine built for artists and AI creators. It turns every song + story —
              whether human-made or AI-generated — into an owned digital asset that
              can be discovered, clustered, and monetized while the creator keeps
              control of the data and the revenue.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/track/shiyan-yishu"
                className="inline-flex items-center justify-center h-12 px-8 rounded-full bg-white text-black font-medium hover:bg-zinc-200 transition-colors duration-200"
              >
                View Live Track
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center h-12 px-8 rounded-full border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors duration-200"
              >
                How it works
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-zinc-800/80">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <h2 className="text-2xl font-semibold mb-14 tracking-tight">
            How it works
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            <div>
              <div className="text-emerald-400 text-sm font-medium mb-3">
                01 — Know
              </div>
              <h3 className="font-medium text-lg mb-3">Name</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Artist uploads a track and a short narrative.
              </p>
            </div>

            <div>
              <div className="text-emerald-400 text-sm font-medium mb-3">
                02 — Knows-How
              </div>
              <h3 className="font-medium text-lg mb-3">Learn</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                AI organizes the story and audio into structured memory.
              </p>
            </div>

            <div>
              <div className="text-emerald-400 text-sm font-medium mb-3">
                03 — Shows-How
              </div>
              <h3 className="font-medium text-lg mb-3">Cluster</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Similar stories and listeners form living communities.
              </p>
            </div>

            <div>
              <div className="text-emerald-400 text-sm font-medium mb-3">
                04 — Does
              </div>
              <h3 className="font-medium text-lg mb-3">Container</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Communities become precise targets. Revenue splits automatically.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80">
        <div className="max-w-6xl mx-auto px-6 h-16 flex flex-col sm:flex-row justify-between items-center gap-2 text-sm text-zinc-500">
          <p>Shiyan Yishu — Fully owned by ECMcCready</p>
          <p>
            π<sub>inv</sub>(c) = 1 − ℓ(c)
          </p>
        </div>
      </footer>
    </div>
  );
}
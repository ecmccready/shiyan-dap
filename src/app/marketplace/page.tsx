import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const cards = [
  { title: "Song", href: "/single" },
  { title: "Playlist", href: "/playlist" },
  { title: "Video", href: "/single" },
];

export default function MarketplacePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Marketplace" />
      <main className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-6">Music Marketplace</h1>
        <div className="flex flex-wrap gap-3 mb-10">
          <Link href="/playlist" className="h-11 px-6 rounded-full bg-emerald-600 text-white text-sm font-medium inline-flex items-center">Playlist</Link>
          <Link href="/single" className="h-11 px-6 rounded-full border border-zinc-700 text-zinc-300 text-sm font-medium inline-flex items-center">Songs</Link>
          <Link href="/" className="h-11 px-6 rounded-full border border-zinc-700 text-zinc-300 text-sm font-medium inline-flex items-center">Shiyan AI Assist</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((card) => (
            <Link key={card.title} href={card.href} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-8 hover:border-emerald-700">
              <h2 className="text-2xl font-semibold">{card.title}</h2>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

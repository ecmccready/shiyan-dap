import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import RailLinks from "@/components/RailLinks";

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
        <h1 className="text-3xl font-bold mb-3">Music Marketplace</h1>
        <p className="text-zinc-400 mb-8 max-w-3xl">Song, Playlist, and Video are on the shelf. No loading state.</p>
        <div className="mb-10"><RailLinks /></div>
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

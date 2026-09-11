import Link from "next/link";

const rails = [
  { href: "/marketplace", label: "Marketplace · KNOW" },
  { href: "/playlist", label: "Playlist · KNOW HOW" },
  { href: "/single", label: "Songs · SHOW" },
  { href: "/bot", label: "Grok Bot · DO" },
];

export default function RailLinks() {
  return (
    <div className="flex flex-wrap gap-3">
      {rails.map((rail) => (
        <Link key={rail.label} href={rail.href} className="h-11 px-6 rounded-full border border-zinc-700 text-zinc-300 text-sm font-medium inline-flex items-center hover:border-emerald-600 hover:text-white">
          {rail.label}
        </Link>
      ))}
    </div>
  );
}
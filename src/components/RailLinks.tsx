import Link from "next/link";

const rails = [
  { href: "/loop", label: "Loop" },
  { href: "/workspace", label: "A names y" },
  { href: "/workbench", label: "B transitions" },
  { href: "/workbench/safety", label: "Safety pack" },
  { href: "/marketplace", label: "List e" },
  { href: "/nfts", label: "Music rail" },
  { href: "/playlist", label: "Playlist" },
  { href: "/single", label: "Songs" },
  { href: "/bot", label: "Namer · Bot" },
  { href: "/architecture", label: "Spec" },
];

export default function RailLinks() {
  return (
    <div className="flex flex-wrap gap-3">
      {rails.map((rail) => (
        <Link
          key={rail.label}
          href={rail.href}
          className="h-11 px-6 rounded-full border border-zinc-700 text-zinc-300 text-sm font-medium inline-flex items-center hover:border-emerald-600 hover:text-white"
        >
          {rail.label}
        </Link>
      ))}
    </div>
  );
}

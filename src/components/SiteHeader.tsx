import Link from "next/link";

const links = [
  { href: "/upload", label: "Create" },
  { href: "/nfts", label: "Prove" },
  { href: "/dashboard", label: "Learn" },
  { href: "/bot", label: "Act" },
];

export default function SiteHeader({ section }: { section?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-black/80 backdrop-blur">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/" className="font-semibold tracking-tight text-lg shrink-0">
            Shiyan
          </Link>
          {section ? <span className="text-zinc-500 text-sm truncate">{section}</span> : null}
        </div>
        <nav className="hidden sm:flex items-center gap-5">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-zinc-400 hover:text-white">
              {link.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/upload"
          className="h-9 px-4 rounded-full bg-emerald-600 text-white text-sm font-medium inline-flex items-center shrink-0"
        >
          Upload a song
        </Link>
      </div>
    </header>
  );
}
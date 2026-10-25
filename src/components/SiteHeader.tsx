"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { writeVertical } from "@/lib/verticles";

const NAV = [
  { href: "/", label: "Workbench" },
  { href: "/emergence", label: "Music" },
  { href: "/#guided-run", label: "New run" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/playlist", label: "Playlist" },
  { href: "/single", label: "Songs" },
];

// Hidden on the Workbench home page only; other pages keep them.
const HOME_HIDDEN = new Set(["/", "/workbench", "/emergence", "/#guided-run", "/workbench#guided-run", "/marketplace", "/playlist", "/single"]);
// Hidden on /workbench/status only.
const STATUS_HIDDEN = new Set(["/", "/workbench", "/emergence", "/marketplace", "/playlist", "/single"]);
// Level 4 pages that share the trimmed /workbench/status header (exact paths; query ignored).
const TRIMMED_PATHS = new Set([
  "/",
  "/workbench",
  "/workbench/status",
  "/workbench/outcome",
  "/workbench/autonomous",
  "/workbench/result",
  "/workbench/autonomous/proof",
  "/roadmap",
]);

export default function SiteHeader({ section }: { section?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const selectedDomain =
    pathname === "/workbench/diagnostic/reference" || pathname === "/workbench/diagnostics"
      ? "diagnostics"
      : "music";
  const nav =
    pathname === "/" || pathname === "/workbench"
      ? NAV.filter((n) => !HOME_HIDDEN.has(n.href))
      : TRIMMED_PATHS.has(pathname)
        ? NAV.filter((n) => !STATUS_HIDDEN.has(n.href))
        : NAV;
  // Upload is hidden on the Workbench home and all trimmed Level 4 pages.
  const showUpload =
    pathname !== "/" && pathname !== "/workbench" && !TRIMMED_PATHS.has(pathname);

  return (
    <header className="border-b border-zinc-800">
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-semibold">
            Aethel Node
          </Link>
          {section ? (
            <span className="text-zinc-500 text-sm">
              {TRIMMED_PATHS.has(pathname) ? section.replace(/\s*·\s*Level 4$/, "") : section}
            </span>
          ) : (
            <Link href="/emergence" className="text-zinc-500 text-sm hover:text-white">
              Music
            </Link>
          )}
        </div>
        {nav.length > 0 && (
          <nav className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-white">
                {n.label}
              </Link>
            ))}
          </nav>
        )}
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          Domains
          <select
            value={selectedDomain}
            onChange={(e) => {
              const id = e.target.value;
              if (id === "diagnostics") {
                router.push("/workbench/diagnostic/reference");
                return;
              }
              writeVertical("music");
              router.push("/emergence");
            }}
            className="h-10 rounded-full bg-zinc-900 border border-zinc-700 px-3 text-sm text-white"
          >
            <option value="music">Music</option>
            <option value="diagnostics">Diagnostics</option>
          </select>
        </label>
        {showUpload && (
          <Link
            href="/upload"
            className="h-10 px-4 rounded-full bg-emerald-600 text-sm inline-flex items-center"
          >
            Upload
          </Link>
        )}
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { VERTICALS as ALL_VERTICALS, readVertical, writeVertical } from "@/lib/verticles";
import { useHydrated } from "@/lib/use-hydrated";

// Header dropdown hides Diagnostic Safety / Regulatory Validation; their pages remain.
const VERTICALS = ALL_VERTICALS.filter((v) => v.id !== "safety" && v.id !== "compliance");

const NAV = [
  { href: "/workbench", label: "Home" },
  { href: "/", label: "Music" },
  { href: "/workbench#guided-run", label: "New run" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/playlist", label: "Playlist" },
  { href: "/single", label: "Songs" },
];

// Hidden on the Home page (/workbench) only; other pages keep them.
const HOME_HIDDEN = new Set(["/workbench", "/", "/workbench#guided-run", "/marketplace", "/playlist", "/single"]);
// Hidden on /workbench/status only (Home stays).
const STATUS_HIDDEN = new Set(["/workbench", "/", "/marketplace", "/playlist", "/single"]);
// Level 4 pages that share the trimmed /workbench/status header (exact paths; query ignored).
const TRIMMED_PATHS = new Set([
  "/workbench/status",
  "/workbench/outcome",
  "/workbench/autonomous",
  "/workbench/result",
  "/workbench/autonomous/proof",
  "/roadmap",
]);

export default function SiteHeader({ section }: { section?: string }) {
  const hydrated = useHydrated();
  const [verticalOverride, setVerticalOverride] = useState<string | null>(null);
  const vertical = verticalOverride ?? (hydrated ? readVertical() : "music");
  const pathname = usePathname();
  const router = useRouter();
  const nav =
    pathname === "/"
      ? NAV.filter((n) => !STATUS_HIDDEN.has(n.href))
      : pathname === "/workbench"
      ? NAV.filter((n) => !HOME_HIDDEN.has(n.href))
      : TRIMMED_PATHS.has(pathname)
        ? NAV.filter((n) => !STATUS_HIDDEN.has(n.href))
        : NAV;
  // Upload is hidden on Home (/workbench) and all TRIMMED_PATHS.
  const showUpload =
    pathname !== "/workbench" && !TRIMMED_PATHS.has(pathname);

  return (
    <header className="border-b border-zinc-800">
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/workbench" className="font-semibold">
            Aethel Node
          </Link>
          {section ? (
            <span className="text-zinc-500 text-sm">
              {TRIMMED_PATHS.has(pathname) ? section.replace(/\s*·\s*Level 4$/, "") : section}
            </span>
          ) : (
            <Link href="/" className="text-zinc-500 text-sm hover:text-white">
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
          Domain
          <select
            // Off the root page, Music shows as a neutral placeholder so choosing Music fires onChange and goes to "/".
            value={pathname !== "/" && vertical === "music" ? "" : vertical}
            onChange={(e) => {
              const id = e.target.value;
              setVerticalOverride(id);
              writeVertical(id);
              if (id === "safety" || id === "compliance") {
                router.push("/workbench");
              }
              if (id === "music") router.push("/");
            }}
            className="h-10 rounded-full bg-zinc-900 border border-zinc-700 px-3 text-sm text-white"
          >
            {pathname !== "/" && (
              <option value="" disabled hidden>
                Select…
              </option>
            )}
            {VERTICALS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
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

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import DomainsDropdown from "./DomainsDropdown";

const NAV = [
  { href: "/workbench", label: "Workbench" },
  { href: "/workbench/home#guided-run", label: "New run" },
  { href: "/workbench/diagnostic", label: "Diagnostics" },
  { href: "/workbench/marketplace", label: "Marketplace" },
];

const SEMI_NAV = [
  { href: "/", label: "Front door" },
  { href: "/assess", label: "Discover" },
  { href: "/journey/characterize", label: "Characterize" },
  { href: "/journey/optimize", label: "Optimize" },
  { href: "/journey/prove", label: "Prove" },
  { href: "/journey/deploy", label: "Deploy" },
  { href: "/workbench/reference-ledger", label: "Ledger" },
];

function isSemiconductorPath(pathname: string): boolean {
  return pathname === "/"
    || pathname === "/assess"
    || pathname.startsWith("/journey/")
    || pathname === "/workbench/reference-ledger"
    || pathname === "/workbench/compute-proof"
    || pathname === "/workbench/acquisition";
}

// Hidden on the Workbench home page only; other pages keep them.
const HOME_HIDDEN = new Set(["/", "/workbench", "/#guided-run", "/workbench#guided-run", "/workbench/home#guided-run", "/workbench/diagnostic", "/workbench/marketplace"]);
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

export default function SiteHeader({ section, brand = "Aethel Node" }: { section?: string; brand?: string }) {
  const pathname = usePathname();
  const isWorkbenchLanding = pathname === "/workbench";
  const isSemiconductor = isSemiconductorPath(pathname);
  const isFocused = pathname === "/workbench/marketplace" || pathname === "/workbench/diagnostic";
  const source = isSemiconductor ? SEMI_NAV : NAV;
  const nav = isSemiconductor
    ? source.filter((n) => n.href !== pathname)
    : isFocused
    ? NAV.filter((n) => n.href !== pathname)
    : isWorkbenchLanding
      ? NAV.filter((n) => !HOME_HIDDEN.has(n.href))
      : TRIMMED_PATHS.has(pathname)
        ? NAV.filter((n) => n.label === "Diagnostics" || n.label === "Marketplace")
        : NAV;

  return (
    <header className="border-b border-zinc-800">
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-semibold">
            {brand}
          </Link>
          {section && !isWorkbenchLanding ? (
            <span className="text-zinc-500 text-sm">
              {TRIMMED_PATHS.has(pathname) ? section.replace(/\s*·\s*Level 4$/, "") : section}
            </span>
          ) : null}
        </div>
        <DomainsDropdown />
        {nav.length > 0 && (
          <nav className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-white">
                {n.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}

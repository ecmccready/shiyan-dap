"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// Domain selector options (non-music). Diagnostics is the default domain.
const DOMAIN_OPTIONS = [
  { id: "diagnostics", label: "Diagnostics", href: "/workbench/diagnostic" },
  { id: "safety", label: "Safety", href: "/workbench/safety" },
];

const NAV = [
  { href: "/", label: "Workbench" },
  { href: "/#guided-run", label: "New run" },
  { href: "/workbench/diagnostic", label: "Diagnostics" },
  { href: "/workbench/marketplace", label: "Marketplace" },
];

// Hidden on the Workbench home page only; other pages keep them.
const HOME_HIDDEN = new Set(["/", "/workbench", "/#guided-run", "/workbench#guided-run", "/workbench/diagnostic", "/workbench/marketplace"]);
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
  const isWorkbenchLanding = pathname === "/" || pathname === "/workbench";
  const isFocused = pathname === "/workbench/marketplace" || pathname === "/workbench/diagnostic";
  const isDomainPromptPage = isWorkbenchLanding || TRIMMED_PATHS.has(pathname);
  const selectedDomain =
    pathname.startsWith("/workbench/diagnostic")
      ? "diagnostics"
      : pathname.startsWith("/workbench/safety")
        ? "safety"
        : isDomainPromptPage
          ? ""
          : "diagnostics";
  const nav = isFocused
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
            Aethel Node
          </Link>
          {section && !isWorkbenchLanding ? (
            <span className="text-zinc-500 text-sm">
              {TRIMMED_PATHS.has(pathname) ? section.replace(/\s*·\s*Level 4$/, "") : section}
            </span>
          ) : null}
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          Domains
          <select
            data-domain-select
            value={selectedDomain}
            onChange={(e) => {
              const d = DOMAIN_OPTIONS.find((o) => o.id === e.target.value);
              if (d) router.push(d.href);
            }}
            className="h-10 rounded-full bg-zinc-900 border border-zinc-700 px-3 text-sm text-white"
          >
            {selectedDomain === "" && (
              <option value="" disabled>
                Select domain
              </option>
            )}
            {DOMAIN_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
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

"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";

// Domains dropdown: every in-scope surface and reference link under Know / Know How / Show / Do.
// Reference links (/api/...) open the live JSON record. Keep Diagnostics and its related data together.
const REF_RUN = "run_mvmt18dm_dpbybz"; // recorded eligible Level 4 run
const DOMAIN_GROUPS = [
  {
    label: "Know",
    items: [
      { label: "Diagnostics", href: "/workbench/diagnostic" },
      { label: "Diagnostic reference fixture", href: "/workbench/diagnostic/reference" },
      { label: "Safety", href: "/workbench/safety" },
      { label: "Global · misdiagnosis", href: "/workbench/global" },
      { label: "Level 4 status", href: "/workbench/status" },
      { label: "Review", href: "/workbench/review" },
    ],
  },
  {
    label: "Know How",
    items: [
      { label: "Level 4 run", href: "/workbench/autonomous" },
      { label: "ROE · Reciprocal Optimization Engine", href: "/workbench/autonomous?roe_drive=1" },
      { label: "Level 3 Self()", href: "/workbench/self" },
      { label: "Workspace", href: "/workbench/workspace" },
      { label: "MCP", href: "/workbench/mcp" },
      { label: "Actor network", href: "/workbench/network" },
    ],
  },
  {
    label: "Show",
    items: [
      { label: "Proof", href: "/workbench/proof" },
      { label: "Result", href: "/workbench/result" },
      { label: "History", href: "/workbench/history" },
      { label: "Peer", href: "/workbench/peer" },
      { label: "Compare", href: "/workbench/compare" },
      { label: "Shiyan + Model 3 proof", href: "/workbench/shiyan" },
      { label: "Ref · Experience record (JSON)", href: "/api/level4/experience" },
      { label: "Ref · Verify eligible run (JSON)", href: `/api/level4/verify?run_id=${REF_RUN}` },
      { label: "Ref · Anchor payload (JSON)", href: `/api/level4/anchor?run_id=${REF_RUN}` },
      { label: "Ref · Audit summary (JSON)", href: "/api/v1/audit/summary" },
      { label: "Ref · Asset map (JSON)", href: "/api/v1/ledger/assets" },
    ],
  },
  {
    label: "Do",
    items: [
      { label: "Start a durable run", href: "/workbench#guided-run" },
      { label: "Declare an outcome", href: "/workbench/outcome" },
      { label: "Client pipeline", href: "/workbench/client" },
      { label: "Offer", href: "/workbench/offer" },
      { label: "Pilot", href: "/workbench/pilot" },
    ],
  },
];
const DOMAIN_ITEMS = DOMAIN_GROUPS.flatMap((g) => g.items);
const ROE_HREF = "/workbench/autonomous?roe_drive=1";

/**
 * Preselect the item whose path is the longest prefix of the current path.
 * Items with a query, hash or /api/ path (ROE, guided run, JSON references) are never prefix-matched; ROE matches only when its query is present.
 */
function domainFor(pathname: string, search: string): string {
  if (pathname === "/workbench/autonomous" && new URLSearchParams(search).get("roe_drive") === "1") return ROE_HREF;
  let best = "";
  let bestHref = "";
  for (const i of DOMAIN_ITEMS) {
    if (i.href.includes("?") || i.href.includes("#") || i.href.startsWith("/api/")) continue;
    if ((pathname === i.href || pathname.startsWith(i.href + "/")) && i.href.length > best.length) {
      best = i.href;
      bestHref = i.href;
    }
  }
  return bestHref;
}

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
  // Query string is read on the client only (no Suspense boundary needed on static pages).
  const search = useSyncExternalStore(
    () => () => {},
    () => window.location.search,
    () => "",
  );
  const selectedDomain = domainFor(pathname, search);
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
              const v = e.target.value;
              if (!v) return;
              // JSON reference links are route handlers: use a full navigation.
              if (v.startsWith("/api/")) window.location.assign(v);
              else router.push(v);
            }}
            className="h-10 rounded-full bg-zinc-900 border border-zinc-700 px-3 text-sm text-white"
          >
            {selectedDomain === "" && (
              <option value="" disabled>
                Select domain
              </option>
            )}
            {DOMAIN_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.items.map((i) => (
                  <option key={i.href} value={i.href}>
                    {i.label}
                  </option>
                ))}
              </optgroup>
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

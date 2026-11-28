"use client";

import { useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DOMAIN_ITEMS } from "@/lib/domains/groups";
import { useRankedDomainGroups } from "@/lib/domains/use-ranked-groups";
import { hrefFor, phiSuffix } from "@/lib/domains/experience-rank";

const ROE_HREF = "/workbench/autonomous?roe_drive=1";

/**
 * Preselect the item whose path is the longest prefix of the current path.
 * Items with a query, hash or /api/ path (ROE, guided run, JSON references) are never prefix-matched; ROE matches only when its query is present.
 */
function domainFor(pathname: string, search: string): string {
  if (pathname === "/workbench/autonomous" && new URLSearchParams(search).get("roe_drive") === "1") return ROE_HREF;
  let best = "";
  for (const i of DOMAIN_ITEMS) {
    if (i.href.includes("?") || i.href.includes("#") || i.href.startsWith("/api/")) continue;
    if ((pathname === i.href || pathname.startsWith(i.href + "/")) && i.href.length > best.length) best = i.href;
  }
  return best;
}

/**
 * Adaptive Domains dropdown: the shared Know / Know How / Show / Do menu, ranked and annotated with the best
 * eligible Φ from the verified-experience store (read-only, cached briefly). Selecting an item that accepts a
 * reuse hand-off opens it with ?reuse=<run id>; everything else navigates exactly as before.
 */
export default function DomainsDropdown() {
  const pathname = usePathname();
  const router = useRouter();
  // Query string is read on the client only (no Suspense boundary needed on static pages).
  const search = useSyncExternalStore(
    () => () => {},
    () => window.location.search,
    () => "",
  );
  const selectedDomain = domainFor(pathname, search);
  const groups = useRankedDomainGroups();

  return (
    <label className="flex w-full min-w-0 items-center gap-2 text-sm text-zinc-400 sm:w-auto">
      <span className="shrink-0">Domains</span>
      <select
        data-domain-select
        value={selectedDomain}
        onChange={(e) => {
          const v = e.target.value;
          if (!v || v.startsWith("planned:")) return;
          const item = groups.flatMap((g) => g.items).find((i) => i.href === v);
          const target = item ? hrefFor(item) : v;
          // JSON reference links are route handlers: use a full navigation.
          if (target.startsWith("/api/")) window.location.assign(target);
          else router.push(target);
        }}
        className="h-10 min-w-0 w-full max-w-full flex-1 rounded-full bg-zinc-900 border border-zinc-700 px-3 text-sm text-white sm:w-auto sm:flex-none"
      >
        {selectedDomain === "" && (
          <option value="" disabled>
            Select domain
          </option>
        )}
        {groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.items.map((i) => (
              <option
                key={i.planned ? `planned:${i.label}` : `${i.label}|${i.href}`}
                value={i.planned ? `planned:${i.label}` : i.href}
                disabled={i.planned === true}
                data-phi={i.phi ?? undefined}
                data-reuse-run={i.reuseRunId ?? undefined}
              >
                {i.label}
                {phiSuffix(i)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

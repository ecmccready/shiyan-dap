"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SiteHeader from "./SiteHeader";
import ClearCopied from "./ClearCopied";

/**
 * Shared frame for the Level 4 surfaces (start → run → result → status).
 * Gives them the same dark theme and header as the rest of the Workbench,
 * plus one sub-nav so every Level 4 page links to every other.
 */
export const LEVEL4_NAV = [
  { href: "/workbench#guided-run", label: "Start" },
  { href: "/workbench/outcome", label: "Declare outcome" },
  { href: "/workbench/autonomous", label: "Autonomous run" },
  { href: "/workbench/result", label: "Result" },
  { href: "/workbench/autonomous/proof", label: "Recovery proof" },
  { href: "/workbench/status", label: "Status" },
  { href: "/workbench/spine", label: "Spine" },
];

export default function Level4Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench · Level 4" />
      <nav
        aria-label="Level 4"
        className="max-w-6xl mx-auto px-6 pt-4 flex flex-wrap gap-2 text-sm"
      >
        {LEVEL4_NAV.map((n) => {
          const active = pathname === n.href;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={`h-8 px-3 rounded-full border inline-flex items-center ${
                active
                  ? "border-emerald-600 text-white"
                  : "border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600"
              }`}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>
      {children}
      <ClearCopied />
    </div>
  );
}

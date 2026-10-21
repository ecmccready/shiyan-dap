"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { VERTICALS as ALL_VERTICALS, readVertical, writeVertical } from "@/lib/verticles";

// Header dropdown hides Diagnostic Safety / Regulatory Validation; their pages remain.
const VERTICALS = ALL_VERTICALS.filter((v) => v.id !== "safety" && v.id !== "compliance");

const NAV = [
  { href: "/workbench", label: "Home" },
  { href: "/", label: "Music" },
  { href: "/workbench/start", label: "Start a run" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/playlist", label: "Playlist" },
  { href: "/single", label: "Songs" },
];

export default function SiteHeader({ section }: { section?: string }) {
  const [vertical, setVertical] = useState("music");

  useEffect(() => {
    setVertical(readVertical());
  }, []);

  return (
    <header className="border-b border-zinc-800">
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/workbench" className="font-semibold">
            Aethel Node
          </Link>
          {section ? (
            <span className="text-zinc-500 text-sm">{section}</span>
          ) : (
            <span className="text-zinc-500 text-sm">Music</span>
          )}
        </div>
        <nav className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-white">
              {n.label}
            </Link>
          ))}
        </nav>
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          Domain
          <select
            value={vertical}
            onChange={(e) => {
              const id = e.target.value;
              setVertical(id);
              writeVertical(id);
              if (id === "safety" || id === "compliance") {
                window.location.href = "/workbench";
              }
              if (id === "music") window.location.href = "/";
            }}
            className="h-10 rounded-full bg-zinc-900 border border-zinc-700 px-3 text-sm text-white"
          >
            {VERTICALS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <Link
          href="/upload"
          className="h-10 px-4 rounded-full bg-emerald-600 text-sm inline-flex items-center"
        >
          Upload
        </Link>
      </div>
    </header>
  );
}

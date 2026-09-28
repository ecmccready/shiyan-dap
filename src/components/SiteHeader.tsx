"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { VERTICALS, readVertical, writeVertical } from "@/lib/verticles";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/workspace", label: "Workspace" },
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
          <Link href="/" className="font-semibold">
            Shiyan
          </Link>
          {section ? (
            <span className="text-zinc-500 text-sm">{section}</span>
          ) : null}
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
              setVertical(e.target.value);
              writeVertical(e.target.value);
              if (e.target.value === "safety") {
                window.location.href = "/workbench/safety";
              }
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

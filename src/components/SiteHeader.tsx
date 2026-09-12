"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { VERTICALS, readVertical, writeVertical } from "@/lib/verticles";

const rails = [
  { href: "/upload", label: "Create" },
  { href: "/nfts", label: "Prove" },
  { href: "/measurements", label: "Learn" },
  { href: "/bot", label: "Act" },
];

export default function SiteHeader({ section }: { section?: string }) {
  const [vertical, setVertical] = useState("music");

  useEffect(() => {
    setVertical(readVertical());
  }, []);

  return (
    <header className="border-b border-zinc-800">
      <div className="max-w-5xl mx-auto px-6 py-4">
        <p className="text-xs tracking-wide text-emerald-400 mb-3">
          A/B Agents · P2P State Machine · All Domains
        </p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="font-semibold">
            Shiyan
          </Link>
          <select
            value={vertical}
            onChange={(e) => {
              setVertical(e.target.value);
              writeVertical(e.target.value);
            }}
            className="h-10 rounded-full bg-zinc-900 border border-zinc-700 px-3 text-sm"
          >
            {VERTICALS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
          <nav className="flex flex-wrap gap-2">
            {rails.map((rail) => (
              <Link
                key={rail.href}
                href={rail.href}
                className={
                  "h-10 px-4 rounded-full text-sm inline-flex items-center " +
                  (section === rail.label ? "bg-emerald-600" : "border border-zinc-700")
                }
              >
                {rail.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
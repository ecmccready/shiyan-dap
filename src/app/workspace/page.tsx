"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function WorkspaceInner() {
  const router = useRouter();
  const q = useSearchParams();
  const domain = q.get("domain") === "safety" ? "safety" : "music";

  return (
    <main className="min-h-screen bg-black text-zinc-100 p-8 max-w-2xl mx-auto space-y-6">
      <p className="text-xs uppercase tracking-widest text-emerald-400">
        Workspace A · governs / observes / validates
      </p>
      <h1 className="text-2xl font-semibold">Workspace A</h1>
      <p className="text-sm text-zinc-400">
        Shiyan is this room. A owns Self() and z. B is the workbench
        A opens — not a customer. Music stays the live vertical.
        Diagnostic safety is created from the workbench, not emitted
        as a diagnosis on this page.
      </p>

      <label className="block text-sm">
        <span className="text-xs text-emerald-400">Domain</span>
        <select
          className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2"
          value={domain}
          onChange={(e) =>
            router.push("/workspace?domain=" + e.target.value)
          }
        >
          <option value="music">Music</option>
          <option value="safety">Diagnostic safety</option>
        </select>
      </label>

      <section className="border border-emerald-800 rounded-lg p-4 space-y-2">
        <p className="text-xs text-emerald-400">Option from A</p>
        <p className="text-lg">Workbench B</p>
        <Link className="text-sm underline" href="/workbench">
          Open workbench
        </Link>
      </section>

      {domain === "music" ? (
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link className="underline" href="/nfts">
            Music rail
          </Link>
          <Link className="underline" href="/playlist">
            Playlist
          </Link>
          <Link className="underline" href="/upload">
            Create
          </Link>
          <Link className="underline" href="/loop">
            Loop
          </Link>
        </nav>
      ) : (
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link className="underline" href="/workbench">
            Workbench
          </Link>
          <Link className="underline" href="/workbench/safety">
            Diagnostic Safety Workbench
          </Link>
        </nav>
      )}
    </main>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<main className="bg-black min-h-screen" />}>
      <WorkspaceInner />
    </Suspense>
  );
}
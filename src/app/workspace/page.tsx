"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
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
        Shiyan is a self-measuring workspace. A owns Self() and z.
        B is the workbench A acts on — not a customer. Music is the
        first live vertical. Diagnostic safety is the evidence
        workbench: prevent and detect diagnostic error, not emit a
        hidden diagnosis.
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

      {domain === "music" ? (
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link className="underline" href="/nfts">
            Music rail
          </Link>
          <Link className="underline" href="/upload">
            Create
          </Link>
          <Link className="underline" href="/playlist">
            Playlist
          </Link>
          <Link className="underline" href="/loop">
            Loop
          </Link>
          <Link className="underline" href="/proof">
            Proof
          </Link>
        </nav>
      ) : (
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link className="underline" href="/workbench">
            Diagnostic Safety Workbench
          </Link>
          <Link className="underline" href="/agents">
            Agents
          </Link>
          <Link className="underline" href="/validation">
            Validation
          </Link>
          <Link className="underline" href="/self">
            .self()
          </Link>
        </nav>
      )}

      <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-auto">
        {`A = Workspace (this page)
B = Workbench (music rail or diagnostic evidence state)
z = measured state, not a paid flag
y ≠ diagnosis
B generates and tests evidence. Conflict stays unresolved.`}
      </pre>
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
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { FrozenAudit, readAudits } from "@/workbench/safety/gatekeeper";

export default function AuditPage() {
  const [audits, setAudits] = useState<FrozenAudit[]>([]);

  useEffect(() => {
    setAudits(readAudits());
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Audit desk" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
          Human-in-the-loop · frozen digests
        </p>
        <h1 className="text-3xl font-bold mb-3">Review desk</h1>
        <p className="text-zinc-400 mb-8 max-w-2xl">
          When Self() cannot reduce Δe below threshold, the run freezes and
          exports a SHA-256 digest of the full history. A reviewer reads the
          pack. The engine does not diagnose.
        </p>

        {audits.length === 0 ? (
          <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-8">
            <p className="text-sm text-zinc-400">No frozen runs yet.</p>
          </section>
        ) : (
          audits.map((a) => (
            <section
              key={a.run_id}
              className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-4"
            >
              <p className="text-xs text-emerald-400 mb-2">{a.handshake}</p>
              <h2 className="text-lg font-semibold mb-2">{a.run_id}</h2>
              <p className="text-sm text-zinc-400 mb-3">{a.reason}</p>
              <p className="text-xs font-mono text-zinc-500 break-all">
                e0={a.e0} · e={a.e_now} · Δe={a.delta_e} · t={a.iterations}
                <br />
                sha256={a.digest_sha256}
              </p>
            </section>
          ))
        )}

        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/workbench/safety">
            Diagnostic workbench
          </Link>
          <Link className="underline" href="/workbench">
            Workbench B
          </Link>
        </nav>
      </main>
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useHydrated } from "@/lib/use-hydrated";

type Row = {
  at: string;
  channelId: string;
  weight: number;
  error: number | null;
  z: string;
  next_action: string;
  external_event: { authoritative: boolean; price: number | null };
  observed: { settled_in_shiyan: boolean };
};

const KEY = "shiyan-ledger-v1";

function readLocalRows(): Row[] {
  try {
    const local = window.localStorage.getItem(KEY);
    if (!local) return [];
    const parsed = JSON.parse(local) as { rows?: Row[] };
    return parsed.rows ?? [];
  } catch {
    return [];
  }
}

export default function LedgerPage() {
  const hydrated = useHydrated();
  const [rows, setRows] = useState<Row[]>([]);
  const [note, setNote] = useState("loading");
  const localRows = hydrated ? readLocalRows() : [];
  const visibleRows = rows.length ? rows : localRows;

  useEffect(() => {
    fetch("/api/workspace/state")
      .then((r) => r.json())
      .then((data) => {
        const next = (data.rows || []) as Row[];
        if (next.length) {
          setRows(next);
          window.localStorage.setItem(
            KEY,
            JSON.stringify({ rows: next, at: new Date().toISOString() })
          );
        }
        setNote(
          next.length
            ? "server instance rows (copied to this browser)"
            : "no server rows — showing browser snapshot if any"
        );
      })
      .catch(() => setNote("state API failed"));
  }, []);

  return (
    <main className="min-h-screen bg-black text-zinc-100 p-8 max-w-2xl mx-auto space-y-6">
      <p className="text-xs uppercase tracking-widest text-emerald-400">
        Ledger · memory for z · not settlement
      </p>
      <h1 className="text-2xl font-semibold">Ledger</h1>
      <p className="text-sm text-zinc-400">
        Predicted B and observed B belong in the same record. External
        CH-b rows take precedence in the loop. This copy is not a
        public chain and does not mark paid.
      </p>
      <p className="text-xs text-zinc-500">{note}</p>

      {visibleRows.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Empty. Compute on{" "}
          <Link className="underline" href="/workspace">
            /workspace
          </Link>{" "}
          or calibrate on{" "}
          <Link className="underline" href="/offer">
            /offer
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-2 text-xs font-mono">
          {visibleRows.map((r) => (
            <li key={r.at} className="border border-zinc-800 rounded-lg p-3">
              {r.at}
              <br />
              {r.channelId} · w={r.weight} · E_B={r.error ?? "n/a"} ·{" "}
              {r.next_action}
              <br />
              {r.z}
              <br />
              {r.external_event.authoritative ? "external" : "endogenous"} ·
              settled_in_shiyan={String(r.observed?.settled_in_shiyan)}
            </li>
          ))}
        </ul>
      )}

      <nav className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/workspace">
          Workspace
        </Link>
        <Link className="underline" href="/workspace/channel">
          Channel
        </Link>
        <Link className="underline" href="/offer">
          Offer
        </Link>
        <Link className="underline" href="/proof">
          Proof
        </Link>
      </nav>
    </main>
  );
}
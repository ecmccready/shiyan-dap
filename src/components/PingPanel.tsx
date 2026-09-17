"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readPings, type PingRecord } from "@/lib/ping";

export default function PingPanel() {
  const [rows, setRows] = useState<PingRecord[]>([]);

  useEffect(() => {
    setRows(readPings());
  }, []);

  const open = rows.filter((row) => row.observed === 0).length;
  const hit = rows.filter((row) => row.observed === 1).length;

  return (
    <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-8">
      <p className="text-xs text-emerald-400 mb-2">Ping Reference · external event</p>
      <p className="text-sm text-zinc-300 mb-3">
        absent {open} · received {hit} · settlement not written
      </p>
      {rows.slice(0, 4).map((row) => (
        <p key={row.ping_id} className="text-sm text-zinc-500">
          {row.ping_id} · observed {row.observed}
        </p>
      ))}
      <Link href="/ping" className="inline-flex mt-4 h-10 px-4 rounded-full border border-zinc-700 text-sm items-center">
        Open ping bench
      </Link>
    </section>
  );
}
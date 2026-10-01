"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

type Exp = {
  id: string;
  title: string;
  y: string;
  z: string;
  e: string;
  delta_e: number;
  cold_delta_e: number;
  used_prior: boolean;
  beats_cold: boolean;
};

export default function ExchangePage() {
  const [rows, setRows] = useState<Exp[]>([]);
  const [beats, setBeats] = useState(false);
  const [name, setName] = useState("Compliance");
  const [reference, setReference] = useState("policy match / exception rate");
  const [note, setNote] = useState("Experience API is the split. Customers buy a measured run. Developers register a B.");
  const [reg, setReg] = useState("");

  useEffect(() => {
    fetch("/api/experience")
      .then((r) => r.json())
      .then((data) => {
        setRows(data.experience || []);
        setBeats(Boolean(data.beats_cold));
      })
      .catch(() => setNote("Experience API did not answer."));
  }, []);

  async function buy() {
    setNote("Opening Stripe for a Safety proof…");
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId: "safety_proof_001",
        title: "Safety proof · measured run",
        cluster: "B",
        offerId: "OFFER-safety-proof-001",
      }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else setNote(data.error || "Checkout did not return a URL.");
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/experience", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "developer", name, reference }),
    });
    const data = await res.json();
    setReg(data.workbench ? `${data.workbench.id} · ${data.workbench.status}` : data.error);
    setNote(data.note || "Registered.");
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench B" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
          Workspace B · exchange
        </p>
        <h1 className="text-3xl font-bold mb-3">Experience API</h1>
        <p className="text-zinc-400 max-w-2xl mb-4">
          Workbench B produces a Run. The Run becomes experience. Customers and
          developers meet that experience here.
        </p>
        <p className="text-zinc-500 text-sm max-w-2xl mb-8">{note}</p>

        <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-2xl p-5 mb-8 overflow-auto leading-6 text-emerald-300">{`Workbench B → Run → Experience → /api/experience
        ├─ Customers   checkout
        └─ Developers  register a B
                 ↓
        more workbenches only after a reference exists`}</pre>

        <section className="border border-zinc-800 rounded-2xl p-5 mb-8">
          <p className="text-emerald-400 text-xs mb-3">GET /api/experience</p>
          <ul className="space-y-3 text-sm">
            {rows.map((row) => (
              <li key={row.id} className="border border-zinc-800 rounded-2xl p-4">
                <p className="text-white">{row.title}</p>
                <p className="text-zinc-500 text-xs mt-1">y {row.y}</p>
                <p className="text-zinc-500 text-xs">z {row.z}</p>
                <p className="text-zinc-300 mt-1">
                  e {row.e} · delta-e {row.delta_e} vs cold {row.cold_delta_e}
                  {row.beats_cold ? " · beats cold" : " · does not beat cold"}
                </p>
              </li>
            ))}
          </ul>
          <p className="text-zinc-500 text-sm mt-4">
            {beats ? "A listed run beats cold Self()." : "No listed run beats cold Self(). Do not sell compounding."}
          </p>
        </section>

        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <section className="border border-zinc-800 rounded-2xl p-5">
            <p className="text-emerald-400 text-xs mb-2">Customers</p>
            <p className="text-sm text-zinc-400 mb-4">
              Buy one measured Safety run. Stripe settles it, or the button shows the error.
            </p>
            <button onClick={buy} className="h-11 px-5 rounded-full bg-emerald-600 text-sm">
              Checkout Safety proof
            </button>
          </section>
          <section className="border border-zinc-800 rounded-2xl p-5">
            <p className="text-emerald-400 text-xs mb-2">Developers</p>
            <form onSubmit={register} className="flex flex-col gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-full bg-zinc-900 border border-zinc-800 px-4 text-sm" />
              <input value={reference} onChange={(e) => setReference(e.target.value)} className="h-11 rounded-full bg-zinc-900 border border-zinc-800 px-4 text-sm" />
              <button className="h-11 px-5 rounded-full border border-zinc-700 text-sm">Register a B</button>
            </form>
            {reg ? <p className="text-xs font-mono text-zinc-500 mt-3">{reg}</p> : null}
          </section>
        </div>

        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/workbench">Workbench B</Link>
          <Link className="underline" href="/workbench/proof">Proof</Link>
          <Link className="underline" href="/marketplace">Marketplace</Link>
        </nav>
      </main>
    </div>
  );
}
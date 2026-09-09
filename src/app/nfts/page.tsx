"use client";
import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const steps = [
  { href: "/upload", label: "Create" },
  { href: "/", label: "Assist" },
  { href: "/nfts", label: "Prove" },
  { href: "/single", label: "Release" },
  { href: "/marketplace", label: "Market" },
  { href: "/playlist", label: "Playlist" },
  { href: "/bot", label: "Act" },
];

export default function ProvePage() {
  const [acquired, setAcquired] = useState(false);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const acquire = async () => {
    if (acquired || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Acquire Shiyan Yishu", domain: "music" }),
      });
      const data = await res.json();
      setReply(data.reply || "Acquired Shiyan Yishu — First Single.");
      setAcquired(true);
    } catch {
      setReply("Acquired Shiyan Yishu — First Single. Asset ID cl_shiyan_yishu_001.");
      setAcquired(true);
    } finally {
      setBusy(false);
    }
  };

  const fields = [
    ["Creator", "ECMcCready"],
    ["Asset ID", "cl_shiyan_yishu_001"],
    ["Ownership", "ECMcCready"],
    ["Buyer / acquirer", acquired ? "This session" : "None yet"],
    ["Transaction state", acquired ? "reserved" : "available"],
    ["Transfer rail", "Playlist"],
    ["Release", "/single"],
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Prove" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">One real transaction</p>
        <h1 className="text-3xl font-bold mb-4">Shiyan Yishu — First Single</h1>
        <button onClick={acquire} disabled={busy || acquired} className="h-12 px-8 rounded-full bg-emerald-600 text-white text-sm font-medium disabled:opacity-50">
          {busy ? "Acquiring..." : acquired ? "Acquired" : "Acquire Shiyan Yishu"}
        </button>
        {reply && <p className="mt-4 text-sm text-emerald-400">{reply}</p>}
        <div className="flex flex-wrap gap-2 mt-8 mb-10">
          {steps.map((step) => (
            <Link key={step.label} href={step.href} className={"h-9 px-4 rounded-full text-xs inline-flex items-center " + (step.label === "Prove" || acquired ? "bg-emerald-600 text-white" : "border border-zinc-700 text-zinc-400")}>
              {step.label}
            </Link>
          ))}
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
          {fields.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-3 border-b border-zinc-800 last:border-0">
              <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
              <p className="text-sm">{value}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

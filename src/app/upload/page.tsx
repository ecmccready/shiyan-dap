"use client";
import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export default function UploadPage() {
  const [fileName, setFileName] = useState("");
  const [goal, setGoal] = useState("Release a living project");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const source = fileName || "no master yet";
    try {
      const res = await fetch("/api/agent?domain=music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: `source=${source}; goal=${goal}; note=${note || "production available without file"}`,
          path: "fast",
        }),
      });
      const data = await res.json();
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Create" />
      <main className="max-w-3xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">Create</p>
        <h1 className="text-3xl font-bold mb-3">Upload</h1>
        <p className="text-zinc-400 mb-8">File optional. Guitar Pro 8 MIDI and Cubase stems can attach later. Value starts now.</p>
        <form onSubmit={handleSubmit} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
          <label className="block text-sm text-zinc-400 mb-2">Audio, MIDI, Guitar Pro, or Cubase export</label>
          <input type="file" accept="audio/*,.gp,.gpx,.mid,.midi,.wav,.mp3,.flac" onChange={(e) => setFileName(e.target.files?.[0]?.name || "")} className="block w-full text-sm mb-5" />
          <input value={goal} onChange={(e) => setGoal(e.target.value)} className="w-full h-11 rounded-xl bg-black border border-zinc-800 px-4 text-sm mb-4" />
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Hook, lyric, missing mix, or leave blank" rows={4} className="w-full rounded-xl bg-black border border-zinc-800 px-4 py-3 text-sm mb-5" />
          <button disabled={loading} className="h-11 px-6 rounded-full bg-emerald-600 text-sm">{loading ? "Opening project..." : "Open project"}</button>
        </form>
        {result && (
          <div className="mt-6">
            <p className="text-emerald-400 text-sm mb-3">{result.cluster?.name || "Project opened"}</p>
            <Link href="/nfts" className="h-10 px-5 rounded-full bg-emerald-600 text-white text-sm inline-flex items-center">Prove / acquire</Link>
          </div>
        )}
      </main>
    </div>
  );
}

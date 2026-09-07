"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export default function UploadPage() {
  const [fileName, setFileName] = useState("");
  const [note, setNote] = useState("");
  const [goal, setGoal] = useState("Release the first single");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/agent?domain=music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: "CREATE project. File: " + (fileName || "no master yet") + ". Goal: " + goal + ". Note: " + note,
          path: "fast",
        }),
      });
      setResult(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="01 Create" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-xs tracking-[0.28em] uppercase text-emerald-400 mb-3">Protocol 01</p>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Create the project</h1>
        <p className="text-zinc-400 mb-8">Start with a song, idea, or work in progress. The master can come later.</p>
        <form onSubmit={handleSubmit} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-8 mb-8">
          <label className="block text-sm text-zinc-400 mb-2">Audio or AI file</label>
          <input type="file" accept="audio/*,.gp,.gpx,.wav,.mp3,.flac" onChange={(e) => setFileName(e.target.files?.[0]?.name || "")} className="block w-full text-sm text-zinc-300 mb-6" />
          <label className="block text-sm text-zinc-400 mb-2">Project goal</label>
          <input value={goal} onChange={(e) => setGoal(e.target.value)} className="w-full rounded-2xl bg-black border border-zinc-800 px-5 py-3 text-sm mb-6" />
          <label className="block text-sm text-zinc-400 mb-2">What do you have right now?</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Hook, lyric, missing mix, audience guess..." rows={4} className="w-full rounded-2xl bg-black border border-zinc-800 px-5 py-4 text-sm mb-6" />
          <button type="submit" disabled={loading} className="h-11 px-6 rounded-full bg-emerald-600 text-white text-sm font-medium disabled:opacity-50">
            {loading ? "Creating project…" : "Create project"}
          </button>
        </form>
        {result && (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
            <p className="text-sm text-emerald-400 mb-2">Project established</p>
            <p className="font-semibold text-lg">{result.cluster?.name || "Shiyan Yishu project"}</p>
            <Link href="/home" className="mt-5 h-10 px-5 rounded-full bg-emerald-600 text-white text-sm font-medium inline-flex items-center">02 Assist →</Link>
          </div>
        )}
      </main>
    </div>
  );
}

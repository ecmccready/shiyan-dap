"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { writeExtra } from "@/lib/ledger";

export default function UploadPage() {
  const router = useRouter();
  const [fileName, setFileName] = useState("");
  const [goal, setGoal] = useState("Release a living project");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const id = "cl_" + Date.now();
    writeExtra({
      id,
      title: goal || "Untitled project",
      creator: "Independent creator",
      source: fileName || "no master yet",
      buyer: "None yet",
      state: "available",
    });
    try {
      await fetch("/api/agent?domain=music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: goal + " " + note, path: "fast" }),
      });
    } catch {}
    setLoading(false);
    router.push("/nfts");
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Create" />
      <main className="max-w-3xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">Create</p>
        <h1 className="text-3xl font-bold mb-3">Upload</h1>
        <p className="text-zinc-400 mb-8">File optional. Opens a proof record other users can acquire.</p>
        <form onSubmit={handleSubmit} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
          <input type="file" accept="audio/*,.gp,.gpx,.mid,.midi,.wav,.mp3,.flac" onChange={(e) => setFileName(e.target.files?.[0]?.name || "")} className="block w-full text-sm mb-5" />
          <input value={goal} onChange={(e) => setGoal(e.target.value)} className="w-full h-11 rounded-xl bg-black border border-zinc-800 px-4 text-sm mb-4" />
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="Hook, lyric, or leave blank" className="w-full rounded-xl bg-black border border-zinc-800 px-4 py-3 text-sm mb-5" />
          <button disabled={loading} className="h-11 px-6 rounded-full bg-emerald-600 text-sm">{loading ? "Opening..." : "Open project"}</button>
        </form>
      </main>
    </div>
  );
}

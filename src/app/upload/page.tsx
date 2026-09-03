"use client";

import { useState } from "react";
import Link from "next/link";

export default function UploadPage() {
  const [fileName, setFileName] = useState("");
  const [note, setNote] = useState("");
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
          input: `Audio attachment: ${fileName || "unnamed master"}. ${note}`,
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
      <header className="border-b border-zinc-800/80">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight text-lg">
              Shiyan Yishu
            </Link>
            <span className="text-zinc-500 text-sm">Upload</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/home" className="text-sm text-zinc-400 hover:text-white">Home</Link>
            <Link href="/single" className="text-sm text-zinc-400 hover:text-white">Single</Link>
            <Link href="/playlist" className="text-sm text-zinc-400 hover:text-white">Playlist</Link>
            <Link href="/marketplace" className="text-sm text-zinc-400 hover:text-white">Marketplace</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Upload</h1>
        <p className="text-zinc-400 mb-8">
          Attach the master when it exists. The First Single can sell before this file is ready.
        </p>

        <form onSubmit={handleSubmit} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-8 mb-8">
          <label className="block text-sm text-zinc-400 mb-2">Audio or AI file</label>
          <input
            type="file"
            accept="audio/*,.gp,.gpx,.wav,.mp3,.flac"
            onChange={(e) => setFileName(e.target.files?.[0]?.name || "")}
            className="block w-full text-sm text-zinc-300 mb-6"
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Track note, version, or AI source..."
            rows={4}
            className="w-full rounded-2xl bg-black border border-zinc-800 px-5 py-4 text-sm mb-6"
          />
          <button
            type="submit"
            disabled={loading}
            className="h-11 px-6 rounded-full bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Attaching…" : "Attach to protocol"}
          </button>
        </form>

        {result && (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
            <p className="text-sm text-emerald-400 mb-2">Attached as cluster</p>
            <p className="font-semibold">{result.cluster?.name}</p>
            <p className="text-sm text-zinc-400 mt-2">
              File: {fileName || "unnamed"} · Token {result.token?.symbol || "MUSIC"}
            </p>
            <Link href="/single" className="inline-block mt-4 text-sm text-emerald-400">
              Back to First Single →
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
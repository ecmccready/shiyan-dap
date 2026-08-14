"use client";

import { useState } from "react";
import Link from "next/link";

type Domain = "music" | "visual" | "text" | "professional";

export default function UploadPage() {
  const [form, setForm] = useState({
    title: "",
    artist: "ECMcCready",
    narrative: "",
    domain: "music" as Domain,
  });
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const domainLabels: Record<Domain, string> = {
      music: "Music",
      visual: "Visual / Generative Art",
      text: "Text / Narrative",
      professional: "Professional Domain",
    };

    const simulated = {
      title: form.title || "Untitled Content",
      artist: form.artist,
      domain: domainLabels[form.domain],
      narrative: form.narrative,
      pyramid: {
        Know: {
          level: "Know",
          description: "Basic facts about the content",
          content: {
            title: form.title || "Untitled Content",
            artist: form.artist,
            domain: domainLabels[form.domain],
            status: "Newly uploaded (simulated)",
          },
        },
        "Knows-How": {
          level: "Knows-How",
          description: "How the content is structured",
          content: {
            narrative_length: form.narrative.length + " characters",
            themes: "Extracted from narrative (simulated)",
          },
        },
        "Shows-How": {
          level: "Shows-How",
          description: "What can be demonstrated",
          content: {
            evidence: ["narrative", "structured memory"],
            ready_for_cluster: true,
          },
        },
        Does: {
          level: "Does",
          description: "Real-world action",
          content: {
            status: "Waiting for clustering & policy extension",
            next_action: "Run full agentic loop",
          },
        },
      },
      message: "Upload simulated successfully. Memory block created.",
    };

    setResult(simulated);
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-zinc-800/80">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight text-lg">
              Shiyan Yishu
            </Link>
            <span className="text-zinc-500 text-sm">Upload</span>
          </div>

          <nav className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="text-sm text-zinc-400 hover:text-white transition-colors duration-200"
            >
              Dashboard
            </Link>
            <Link
              href="/track/shiyan-yishu"
              className="text-sm text-zinc-400 hover:text-white transition-colors duration-200"
            >
              Track
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        {!submitted ? (
          <>
            <h1 className="text-3xl font-bold tracking-tight mb-3">
              Upload Simulation
            </h1>
            <p className="text-zinc-400 mb-12 leading-relaxed">
              Simulate uploading content in any domain. The system will create a
              Miller Pyramid memory block (GTP demo).
            </p>

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Domain Selector */}
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Domain
                </label>
                <select
                  value={form.domain}
                  onChange={(e) =>
                    setForm({ ...form, domain: e.target.value as Domain })
                  }
                  className="w-full bg-zinc-900/60 border border-zinc-700 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-emerald-500 transition-colors duration-200"
                >
                  <option value="music">Music</option>
                  <option value="visual">Visual / Generative Art</option>
                  <option value="text">Text / Narrative</option>
                  <option value="professional">Professional Domain</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) =>
                    setForm({ ...form, title: e.target.value })
                  }
                  placeholder="e.g. Neon Captivity"
                  className="w-full bg-zinc-900/60 border border-zinc-700 rounded-xl px-4 py-3.5 text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors duration-200"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Creator
                </label>
                <input
                  type="text"
                  value={form.artist}
                  onChange={(e) =>
                    setForm({ ...form, artist: e.target.value })
                  }
                  className="w-full bg-zinc-900/60 border border-zinc-700 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-emerald-500 transition-colors duration-200"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Narrative / Description
                </label>
                <textarea
                  value={form.narrative}
                  onChange={(e) =>
                    setForm({ ...form, narrative: e.target.value })
                  }
                  rows={5}
                  placeholder="Describe the story, concept, or content..."
                  className="w-full bg-zinc-900/60 border border-zinc-700 rounded-xl px-4 py-3.5 text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors duration-200 resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full h-12 rounded-full bg-white text-black font-medium hover:bg-zinc-200 transition-colors duration-200"
              >
                Simulate Upload
              </button>
            </form>
          </>
        ) : (
          <div className="space-y-10">
            <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-2xl p-6">
              <p className="text-emerald-400 font-medium mb-1">
                {result.message}
              </p>
              <p className="text-zinc-400 text-sm">
                <span className="text-white">{result.title}</span> by {result.artist}
                <span className="ml-2 text-emerald-500/80">· {result.domain}</span>
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-6 text-emerald-400 tracking-wide">
                Generated Miller Pyramid
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {Object.entries(result.pyramid).map(([key, value]: any) => (
                  <div
                    key={key}
                    className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5"
                  >
                    <h3 className="text-sm font-medium text-emerald-400 mb-1">
                      {value.level}
                    </h3>
                    <p className="text-xs text-zinc-500 mb-3">
                      {value.description}
                    </p>
                    <div className="text-sm text-zinc-300 space-y-1.5">
                      {Object.entries(value.content).map(([k, v]) => (
                        <div key={k}>
                          <span className="text-zinc-500">{k}: </span>
                          {String(v)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                setSubmitted(false);
                setForm({
                  title: "",
                  artist: "ECMcCready",
                  narrative: "",
                  domain: "music",
                });
                setResult(null);
              }}
              className="w-full h-12 rounded-full border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors duration-200"
            >
              Simulate Another Upload
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
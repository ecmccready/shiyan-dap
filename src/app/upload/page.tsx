"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import RailLinks from "@/components/RailLinks";
import { writeExtra } from "@/lib/ledger";

export default function UploadPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const name = title.trim() || "Untitled project";
    setBusy(true);
    const license = "Personal listen. Sync and labels stay on /playlist.";
    const narrative = story.trim() || "Draft story. Assist can deepen this later.";

    writeExtra({
      id: "cl_" + Date.now(),
      title: name,
      creator: "Creator",
      owner: "Creator",
      buyer: "None yet",
      state: "available",
      founder: false,
      status: "production available",
    });

    try {
      await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: name, action: "upload", paid: false }),
      });
    } catch {}

    setNote(license + " " + narrative);
    setBusy(false);
    router.push("/nfts");
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Create" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">Create</p>
        <h1 className="text-3xl font-bold mb-3">Upload</h1>
        <p className="text-zinc-400 mb-8">
          File is optional. Title becomes a ledger asset. No crypto screen.
        </p>
        <div className="mb-8">
          <RailLinks />
        </div>
        <form onSubmit={submit} className="space-y-5 max-w-xl">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Song or project title"
            className="w-full h-12 rounded-2xl bg-zinc-900 border border-zinc-800 px-4"
          />
          <textarea
            value={story}
            onChange={(e) => setStory(e.target.value)}
            placeholder="Optional story, hook, or license note"
            className="w-full h-32 rounded-2xl bg-zinc-900 border border-zinc-800 p-4"
          />
          <input type="file" accept=".gp,.gpx,.mid,.wav,.mp3,.zip" className="text-sm text-zinc-500" />
          <button disabled={busy} className="h-11 px-6 rounded-full bg-emerald-600 text-sm">
            {busy ? "Opening ledger..." : "Put on the ledger"}
          </button>
        </form>
        {note && <p className="mt-6 text-sm text-zinc-500">{note}</p>}
      </main>
    </div>
  );
}
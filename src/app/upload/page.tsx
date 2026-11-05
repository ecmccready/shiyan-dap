"use client";

export default function UploadPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-4">Upload</h1>
        <p className="text-zinc-400 mb-6">
          File is optional. Title becomes a ledger asset. No crypto screen.
        </p>
        <form className="space-y-5 max-w-xl">
          <input
            placeholder="Song or project title"
            className="w-full h-12 rounded-2xl bg-zinc-900 border border-zinc-800 px-4"
          />
          <textarea
            placeholder="Optional story, hook, or license note"
            className="w-full h-32 rounded-2xl bg-zinc-900 border border-zinc-800 p-4"
          />
          <input type="file" className="text-sm text-zinc-500" />
          <button className="h-11 px-6 rounded-full bg-emerald-600 text-sm">
            Put on the ledger
          </button>
        </form>
      </main>
    </div>
  );
}
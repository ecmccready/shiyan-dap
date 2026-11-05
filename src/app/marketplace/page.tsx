
"use client";

export default function MarketplacePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-4">Marketplace</h1>
        <p className="text-zinc-400 mb-6">
          Peer-visible surfaces. Known peers advertise shareable view surfaces and clipboard evidence packs. Soft-compat warnings only.
        </p>
        <ul className="list-disc pl-5 space-y-2 text-sm text-zinc-300">
          <li>Look-back and Medicare view surfaces.</li>
          <li>Clipboard evidence packs that carry view_url.</li>
          <li>Audit, asset map and compliance paths.</li>
        </ul>
        <p className="text-xs text-zinc-500 mt-6">Display only. No server writes.</p>
      </main>
    </div>
  );
}
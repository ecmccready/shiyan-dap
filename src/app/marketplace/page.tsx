"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clusterToNFTMetadata } from "@/lib/nft";
import StripePayment from "@/components/StripePayment";

export default function MarketplacePage() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [mintedNFT, setMintedNFT] = useState<any>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const loadInventory = async () => {
    try {
      const res = await fetch("/api/marketplace");
      const data = await res.json();
      setInventory(data.inventory || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const domains = [
      "music",
      "music-video",
      "visual",
      "social-transmedia",
      "gameplay",
      "animation",
      "real-estate",
      "esports",
    ];

    fetch("/api/marketplace/clear", { method: "POST" })
      .then(() =>
        Promise.all(
          domains.map((domain) =>
            fetch(`/api/agent?domain=${domain}`).then((res) => res.json())
          )
        )
      )
      .then(() => loadInventory())
      .catch(() => {
        setLoading(false);
        loadInventory();
      });
  }, []);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    try {
      const res = await fetch("/api/marketplace/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.payment?.clientSecret) {
          setClientSecret(data.payment.clientSecret);
        }
        await loadInventory();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(null);
    }
  };

  const handleMint = async (cluster: any) => {
    const metadata = clusterToNFTMetadata(cluster);
    try {
      const res = await fetch("/api/nft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadata,
          owner: cluster.owner,
          clusterId: cluster.id,
        }),
      });
      const data = await res.json();
      setMintedNFT(data.success ? data.nft.metadata : metadata);
    } catch (err) {
      console.error(err);
      setMintedNFT(metadata);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-400">Loading marketplace inventory…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800/80">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight text-lg">
              Shiyan Yishu
            </Link>
            <span className="text-zinc-500 text-sm">Marketplace</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white">
              Dashboard
            </Link>
            <Link href="/tokens" className="text-sm text-zinc-400 hover:text-white">
              Tokens
            </Link>
            <Link href="/playlist" className="text-sm text-zinc-400 hover:text-white">
              Playlist
            </Link>
            <Link href="/single" className="text-sm text-zinc-400 hover:text-white">
              Single
            </Link>
            <Link href="/nfts" className="text-sm text-zinc-400 hover:text-white">
              My NFTs
            </Link>
            <Link href="/bot" className="text-sm text-zinc-400 hover:text-white">
              Grok Bot
            </Link>
            <Link href="/home" className="text-sm text-zinc-400 hover:text-white">
              Home
            </Link>
            <Link href="/measurements" className="text-sm text-zinc-400 hover:text-white">
              Measurements
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Missing Middle Marketplace
          </h1>
          <p className="text-zinc-400 max-w-2xl">
            y-axis retention. Clusters contain user Homes. Ads pay the user and
            the engine. C2C feeds B2C, then B2B. Playlist is the transfer rail:
            x,y + x,y = z.
          </p>
          <div className="flex flex-wrap gap-3 mt-5">
            <Link
              href="/single"
              className="h-9 px-4 rounded-full bg-emerald-600 text-white text-xs font-medium flex items-center"
            >
              First Single
            </Link>
            <Link
              href="/playlist"
              className="h-9 px-4 rounded-full bg-amber-600 text-white text-xs font-medium flex items-center"
            >
              Playlist checkout
            </Link>
            <Link
              href="/home"
              className="h-9 px-4 rounded-full bg-zinc-800 text-white text-xs font-medium flex items-center"
            >
              Contained Homes
            </Link>
          </div>
        </div>

        {inventory.length === 0 ? (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-12 text-center">
            <p className="text-zinc-400">No clusters in inventory yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {inventory.map((cluster) => (
              <div
                key={cluster.id}
                className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">{cluster.name}</h2>
                    <p className="text-sm text-zinc-400 mt-1">
                      {cluster.domain} · Owner: {cluster.owner}
                    </p>
                    {cluster.containedHome && (
                      <Link
                        href={cluster.containedHome.href}
                        className="text-xs text-zinc-400 hover:text-white mt-1 inline-block"
                      >
                        Open contained Home · {cluster.containedHome.layer}
                      </Link>
                    )}
                    {cluster.sovereignty && (
                      <p className="text-xs text-zinc-500 mt-1">
                        User keeps data · Protocol owned by{" "}
                        {cluster.sovereignty.protocolOwner}
                      </p>
                    )}
                    {cluster.adPayout && (
                      <p className="text-xs text-emerald-400 mt-1">
                        Ad pay · User ${cluster.adPayout.userPayout} · Engine $
                        {cluster.adPayout.enginePayout} · later{" "}
                        {cluster.adPayout.later}
                      </p>
                    )}
                    {cluster.emergence && (
                      <p className="text-xs text-zinc-500 mt-1">
                        x {cluster.emergence.x} · y {cluster.emergence.y} · z{" "}
                        {cluster.emergence.z}
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full capitalize ${
                      cluster.status === "available"
                        ? "bg-emerald-900/50 text-emerald-400"
                        : cluster.status === "reserved"
                        ? "bg-amber-900/50 text-amber-400"
                        : "bg-zinc-700 text-zinc-300"
                    }`}
                  >
                    {cluster.status}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-4 text-sm mb-5">
                  <div>
                    <p className="text-zinc-500 text-xs">
                      π<sub>inv</sub>
                    </p>
                    <p className="font-medium">{cluster.pi_inv}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Similarity</p>
                    <p className="font-medium">{cluster.similarity}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Size</p>
                    <p className="font-medium">{cluster.size}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Attention</p>
                    <p className="font-medium">
                      {cluster.adSignal?.attentionScore ?? "—"}
                    </p>
                    <p className="text-[10px] uppercase text-zinc-500">
                      {cluster.adSignal?.label || ""}
                    </p>
                  </div>
                </div>

                {cluster.status === "settled" && cluster.artistPayout && (
                  <div className="mb-5 p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/40">
                    <p className="text-xs text-emerald-400 mb-1">
                      Simulated Settlement
                    </p>
                    <p className="text-lg font-semibold text-emerald-400">
                      ${cluster.artistPayout.toFixed(2)} paid to {cluster.owner}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mb-5">
                  {cluster.tags?.map((tag: string, i: number) => (
                    <span
                      key={`${tag}-${i}`}
                      className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3">
                  {cluster.status === "available" && (
                    <button
                      onClick={() => updateStatus(cluster.id, "reserved")}
                      disabled={updating === cluster.id}
                      className="flex-1 h-10 rounded-full bg-amber-600/90 text-white text-sm font-medium hover:bg-amber-500 disabled:opacity-50"
                    >
                      {updating === cluster.id ? "Reserving…" : "Reserve"}
                    </button>
                  )}

                  {cluster.status === "reserved" && (
                    <button
                      onClick={() => updateStatus(cluster.id, "settled")}
                      disabled={updating === cluster.id}
                      className="flex-1 h-10 rounded-full bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {updating === cluster.id ? "Settling…" : "Settle"}
                    </button>
                  )}

                  {cluster.status === "settled" && (
                    <>
                      <div className="flex-1 h-10 rounded-full border border-zinc-700 text-zinc-400 text-sm flex items-center justify-center">
                        Settled
                      </div>
                      <button
                        onClick={() => handleMint(cluster)}
                        className="h-10 px-5 rounded-full bg-purple-600 text-white text-sm font-medium hover:bg-purple-500"
                      >
                        Mint as NFT
                      </button>
                    </>
                  )}

                  {cluster.status !== "available" && (
                    <button
                      onClick={() => updateStatus(cluster.id, "available")}
                      disabled={updating === cluster.id}
                      className="h-10 px-4 rounded-full border border-zinc-700 text-zinc-400 text-sm hover:border-zinc-500 hover:text-white disabled:opacity-50"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {mintedNFT && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-purple-400">
                NFT Metadata (Simulated Mint)
              </h3>
              <button
                onClick={() => setMintedNFT(null)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <pre className="text-xs text-zinc-300 bg-black/50 p-4 rounded-xl overflow-x-auto">
              {JSON.stringify(mintedNFT, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {clientSecret && (
        <StripePayment
          clientSecret={clientSecret}
          onSuccess={() => {
            setClientSecret(null);
            loadInventory();
          }}
          onCancel={() => setClientSecret(null)}
        />
      )}
    </div>
  );
}
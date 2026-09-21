import Link from "next/link";

type Search = Promise<{
  session_id?: string;
  asset?: string;
  cluster?: string;
}>;

export default async function ProofPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const q = await searchParams;
  const sessionId = q.session_id || "";
  const asset = q.asset || "cl_shiyan_yishu_001";
  const cluster = q.cluster || "";

  return (
    <main className="min-h-screen bg-black text-zinc-100 p-8 max-w-2xl mx-auto space-y-6">
      <p className="text-xs uppercase tracking-widest text-emerald-400">
        Proof chain · payment is not Shiyan state
      </p>
      <h1 className="text-2xl font-semibold">Proof</h1>
      <p className="text-sm text-zinc-400">
        A Stripe return URL is not settlement. Observation is the webhook
        setting ping observed=1. This page only displays correlation.
      </p>
      <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-auto">
        {`OFFER            OFFER-shiyan-yishu-001
TRANSACTION      ${sessionId || "(no session_id — not returned from Checkout)"}
ASSET            ${asset}
CLUSTER          ${cluster || "-"}
EXTERNAL EVENT   webhook POST /api/stripe/webhook
MEASUREMENT      /measurements
z                not claimed from this URL`}
      </pre>
      <ul className="text-sm text-zinc-400 space-y-1">
        <li>session_id present is not paid in Shiyan</li>
        <li>observed 1 comes from Stripe signature + webhook</li>
        <li>founder in this browser is still A</li>
      </ul>
      <nav className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/offer">
          Offer
        </Link>
        <Link className="underline" href="/nfts">
          /nfts live rail
        </Link>
        <Link className="underline" href="/api/stripe/webhook">
          Webhook
        </Link>
        <Link className="underline" href="/measurements">
          Learn
        </Link>
      </nav>
    </main>
  );
}
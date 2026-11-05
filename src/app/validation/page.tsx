import Link from "next/link";

export default function ValidationPage() {
  return (
    <main className="min-h-screen bg-black text-zinc-100 p-8 max-w-2xl mx-auto space-y-6">
      <p className="text-xs uppercase tracking-widest text-emerald-400">
        Validation memory · no enigma
      </p>
      <h1 className="text-2xl font-semibold">Validate</h1>
      <p className="text-sm text-zinc-400">
        This page is the written memory of what this sprint actually
        observed. It is not a puzzle and it does not settle state.
      </p>

      <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-auto">
        {`HELD
  /offer                 commercial object, Buy as B $1
  /proof                 live, session_id is correlation only
  /api/stripe/webhook    GET ok, settlement_written false
  CLI listen             sandbox POST 200 after whsec matched
  checkout success_url   /proof?session_id={CHECKOUT_SESSION_ID}
  README                 positioning copy on main
  /nfts                  October live $1 rail still in scope

FAILED THEN FIXED
  checkout catch         truncated json line 66, Next 16 parse error
  /proof Production      404 until that parse error shipped

NOT CLAIMED
  Level 3
  independent B
  Dashboard webhook destination (CLI listen is temporary)
  VAT / business-information task
  enigma                 not a Shiyan object — deleted from this map`}
      </pre>

      <nav className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/offer">
          Offer
        </Link>
        <Link className="underline" href="/proof">
          Proof
        </Link>
        <Link className="underline" href="/nfts">
          /nfts
        </Link>
        <Link className="underline" href="/measurements">
          Learn
        </Link>
        <Link className="underline" href="/workspace">
          Workspace
        </Link>
      </nav>
    </main>
  );
}
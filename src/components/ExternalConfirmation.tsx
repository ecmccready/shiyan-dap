import Link from "next/link";
import { AGENT_ROLES_DOC_URL } from "@/lib/journey";

const WORKFLOW_URL = `${AGENT_ROLES_DOC_URL}#external-confirmation-workflow`;

/**
 * "External confirmation": what an outside party can check today without the team narrating it, and what is not yet confirmed.
 * Static text and links only; it computes nothing and approves nothing. Keep in sync with the README section of the same name.
 */
export default function ExternalConfirmation({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const box = tone === "dark" ? "border-zinc-800 text-zinc-300" : "border-neutral-300 text-neutral-700";
  const muted = tone === "dark" ? "text-zinc-500" : "text-neutral-500";
  return (
    <section data-external-confirmation aria-labelledby="external-confirmation-heading" className={`rounded border p-4 text-sm space-y-3 ${box}`}>
      <h2 id="external-confirmation-heading" className="font-medium">External confirmation</h2>
      <p>What an outside party can check today, without the team narrating it:</p>
      <ul className="list-disc space-y-1 pl-5 text-xs">
        <li>
          Three Safety-proof error wins on <Link className="underline" href="/workbench/proof">/workbench/proof</Link>: Φ 0.014 (incomplete evidence pack), 0.065 (missing measurements) and 0.065 (provenance gap). Each is a cold Self() run against a reuse run on the same plant, and counts as a win only when the reuse final e is strictly below the cold final e. The page recomputes them in your browser from code in the repo.
        </li>
        <li>
          Recorded Level 4 runs can be replayed at <a className="underline" href="/api/level4/verify">/api/level4/verify</a> (add <span className="font-mono">?run_id=…</span>), which recomputes the stored e, e0, cold e, Φ and eligibility. That endpoint covers recorded runs, not the three proof plants above.
        </li>
        <li>
          The MCP commercial case, Φ +0.159 (sealed sequence 0.171 against a greedy cold run at 0.33), on <Link className="underline" href="/workbench/peer">/workbench/peer</Link>, <Link className="underline" href="/workbench/compare">compare</Link>, <Link className="underline" href="/workbench/independent">independent</Link> and <Link className="underline" href="/workbench/independence">independence</Link>: tick the cold-run checkbox, then the commercial-case checkbox. This starting plant is constructed by us, not customer data. An exhaustive search of all four-step orders also reaches 0.171, so it beats the greedy cold controller, not an exhaustive one. On B1&apos;s default start the same comparison gives Φ −0.051, not a win.
        </li>
        <li>
          The evidence-pack export on <Link className="underline" href="/workbench/result">/workbench/result</Link> and the Φ &gt; 0 pilot checklist on <Link className="underline" href="/workbench/pilot">/workbench/pilot</Link>, which says &quot;ready&quot; only for an eligible run with an exportable pack and a strictly positive Φ.
        </li>
      </ul>
      <p>Not yet externally confirmed:</p>
      <ul className="list-disc space-y-1 pl-5 text-xs">
        <li>No paid pilot has happened, and no customer has validated the value. Nothing is settled or revenue.</li>
        <li>No third-party attestation. The audit summary is a heuristic mock scan, and no outside party has reviewed or replicated these results.</li>
        <li>Any economic benefit is self-reported by the customer, stored in their browser, and not verified by the engine or the ledger.</li>
        <li>The anchor is a dry run: the Merkle root is prepared, nothing is submitted on-chain. The micro-ledger holds test events, not customer settlements.</li>
        <li>The proof plants and the commercial case are our own constructed cases, and the Level 4 runs were made by us.</li>
      </ul>
      <p className={`text-xs ${muted}`}>
        Evidence goes to an outside party only after a person reviews it:{" "}
        <a className="underline" href={WORKFLOW_URL}>External confirmation workflow</a> (Agent B produces the pack and links, a human reviews, then it is shared).
      </p>
    </section>
  );
}

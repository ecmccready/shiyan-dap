import Link from "next/link";
import { PROMOTION_RULE } from "@/lib/reference-ledger/types";
import {
  ADVANTAGE,
  ADVANTAGE_LIMIT,
  LEVEL4_REUSE_PATH,
  LOOP_LAYERS,
  REFERENCE_LEDGER_PATH,
  RETENTION_SENTENCE,
  ROE_SELECTOR_PATH,
  VERSA_SUMMARY_PATH,
  VIRTUAL_CHIP_LEDGER_PATH,
  versa,
} from "@/lib/semiconductor/loop";

const card = "flex h-full min-w-0 flex-col break-words rounded-2xl border border-zinc-800 p-4";
const linkClass = "text-emerald-400 underline";

/** Inspectable three-layer loop for the Physical AI front door. */
export default function RecursiveLoop() {
  const silicon = LOOP_LAYERS[0]!;
  const robotics = LOOP_LAYERS[1]!;
  const governance = LOOP_LAYERS[2]!;
  return (
    <section id="convergence-loop" data-recursive-loop aria-labelledby="convergence-loop-title" className="scroll-mt-8 space-y-6">
      <div className="space-y-3">
        <p className="font-mono text-xs text-emerald-400">One path</p>
        <h2 id="convergence-loop-title" className="text-2xl font-semibold">Convergence to emergence</h2>
        <p className="max-w-3xl text-zinc-300">{ADVANTAGE}</p>
        <p className="max-w-3xl text-sm text-zinc-400">{ADVANTAGE_LIMIT}</p>
      </div>

      <p className="text-sm text-emerald-400">
        Compute / Silicon → Physical AI / Robotics → Telemetry / Governance → next baseline
      </p>

      <ol aria-label="Each layer feeds the next" className="grid list-none gap-4 p-0 md:grid-cols-3">
        <li data-feeds-next={silicon.feeds} data-loop-layer="silicon" className={card}>
          <h3 className="text-lg font-semibold">{silicon.heading}</h3>
          <p className="mt-2 text-sm text-zinc-400">
            Virtual-chip software model and RTL. 4D-SCP hybrid v0.1.30, and the v0.1.31 Versa bitstream on {versa.device}.
          </p>
          <dl className="mt-3 space-y-1 text-sm">
            <div>
              <dt className="text-zinc-500">Median Fmax</dt>
              <dd className="font-mono" title={`${versa.exactFmax} MHz, the unrounded five-seed median`}>{versa.shownFmax} MHz</dd>
            </div>
            <div>
              <dt className="text-zinc-500">TRELLIS_COMB utilization</dt>
              <dd className="font-mono">
                {versa.shownPct}% ({versa.combUsedLabel}/{versa.combAvailLabel} TRELLIS_COMB)
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Routing</dt>
              <dd className="font-mono">{versa.routes}/{versa.seeds} seeds routed</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-zinc-300">
            Bit-exact. Status: bitstream ready, awaiting physical board. Power: {versa.power}. Not yet physically validated.
            Figures are read from <span className="font-mono">{VERSA_SUMMARY_PATH}</span>.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            v0.1.30 is the hybrid. Its measured table is on Computational Improvement Proof. This Fmax is the reduced Versa image, not that full loop.
          </p>
          <p className="mt-3 text-sm font-medium text-emerald-400">{silicon.feedsNext}</p>
          <p className="mt-1 text-xs text-zinc-500">Design rule. Nothing writes a bitstream measurement into a robotics policy.</p>
          <ul className="mt-3 space-y-1 text-sm">
            <li><a href="#compute-silicon" className={linkClass}>Reference card</a></li>
            <li><Link href="/workbench/compute-proof" className={linkClass}>Computational Improvement Proof</Link></li>
            <li><Link href="/workbench/reference-ledger" className={linkClass}>Reference Data Ledger</Link></li>
          </ul>
        </li>

        <li data-feeds-next={robotics.feeds} data-loop-layer="robotics" className={card}>
          <h3 className="text-lg font-semibold">{robotics.heading}</h3>
          <p className="mt-2 text-sm text-zinc-400">
            Long-horizon policies. The same proof gate is the design rule: synthetic fixtures, and evidence is retained only when it is verified.
            The bridge is silicon performance to real-world physical autonomy.
          </p>
          <p className="mt-3 text-sm text-zinc-300">
            Status: synthetic. No field metric. Real robot control remains outside the engine.
            Next-run reuse of these fixtures is planned. Synthetic records are excluded from the next action
            (<span className="font-mono">{ROE_SELECTOR_PATH}</span>).
          </p>
          <p className="mt-3 text-sm font-medium text-emerald-400">{robotics.feedsNext}</p>
          <p className="mt-1 text-xs text-zinc-500">Design rule. A synthetic policy result does not open a commercial charge.</p>
          <ul className="mt-3 space-y-1 text-sm">
            <li><Link href="/workbench/robotics" className={linkClass}>Long-horizon robotics policies</Link></li>
            <li><Link href="/workbench/robotics/benchmark" className={linkClass}>Robotics benchmark</Link></li>
            <li><Link href="/workbench/robotics/value" className={linkClass}>Robotics value</Link></li>
            <li><Link href="/workbench/robotics/experiment" className={linkClass}>Robotics experiment</Link></li>
            <li><Link href="/workbench/robotics/policies" className={linkClass}>Robotics policies</Link></li>
          </ul>
        </li>

        <li data-feeds-next={governance.feeds} data-loop-layer="governance" className={card}>
          <h3 className="text-lg font-semibold">{governance.heading}</h3>
          <p className="mt-2 text-sm text-zinc-400">
            Evidence ledger, the Level 4 plant, and commercial conversion. Payment follows measured proof.
            Medicare intelligence and other implementable domains sit in this layer.
          </p>
          <p className="mt-3 text-sm text-zinc-300">
            Status: implemented for the Level 4 plant. An experience that passes the reuse filter in <span className="font-mono">{LEVEL4_REUSE_PATH}</span> is reused as the next action. That filter requires eligible, COMPLETE, and phi greater than zero, ahead of the cold Self() baseline, plus the tensor and eligibility gates in that file. Link only. The plant is not modified.
          </p>
          <p className="mt-2 text-sm text-zinc-300">
            Medicare intelligence is a public-data fixture. No PHI. Not a clinical claim.
          </p>
          <p className="mt-3 text-sm font-medium text-emerald-400">{governance.feedsNext}</p>
          <ul className="mt-3 space-y-1 text-sm">
            <li><Link href="/workbench/reference-ledger" className={linkClass}>Reference Data Ledger</Link></li>
            <li><Link href="/workbench/autonomous" className={linkClass}>Level 4 plant</Link></li>
            <li><Link href="/workbench/status" className={linkClass}>Level 4 status</Link></li>
            <li><Link href="/workbench/offer" className={linkClass}>Offer</Link></li>
            <li><Link href="/workbench/pilot" className={linkClass}>Pilot</Link></li>
            <li><Link href="/workbench/journey" className={linkClass}>Proof-to-payment journey</Link></li>
            <li><Link href="/workbench/medicare" className={linkClass}>Medicare intelligence</Link></li>
          </ul>
        </li>
      </ol>

      <div aria-hidden="true" className="flex items-center gap-3 text-xs uppercase tracking-widest text-emerald-400">
        <span className="h-px flex-1 bg-emerald-900" />
        <span>returns as the next baseline</span>
        <span className="h-px flex-1 bg-emerald-900" />
      </div>

      <div className="space-y-3 rounded-2xl border border-zinc-800 p-5">
        <h3 className="text-lg font-semibold">Retention and baseline</h3>
        <p className="text-zinc-200">{RETENTION_SENTENCE}</p>
        <p className="text-sm text-zinc-400">{ADVANTAGE_LIMIT}</p>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-200">Silicon measurement</dt>
            <dd className="mt-1 text-zinc-400">
              Status: implemented, routed and simulated. Bit-exact. {versa.routes}/{versa.seeds} seeds routed.
              Median Fmax {versa.shownFmax} MHz. TRELLIS_COMB {versa.shownPct}% ({versa.combUsedLabel}/{versa.combAvailLabel}).
              Reproducible copies: <span className="font-mono">{VIRTUAL_CHIP_LEDGER_PATH}</span> and <span className="font-mono">{REFERENCE_LEDGER_PATH}</span>.
              Status: bitstream ready, awaiting physical board. Power: {versa.power}. Not yet physically validated.
            </dd>
          </div>
          <div>
            <dt className="text-zinc-200">Silicon retention</dt>
            <dd className="mt-1 text-zinc-400">
              Status: retained in the Reference Data Ledger. Each record names the baseline it was measured against.
              Becoming the next place-and-route baseline is a design rule, not an automatic rewrite. {PROMOTION_RULE}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-200">Robotics evaluation</dt>
            <dd className="mt-1 text-zinc-400">
              Status: synthetic. Next-run reuse is planned. The selector excludes synthetic records, so these fixtures do not become the next action.
            </dd>
          </div>
          <div>
            <dt className="text-zinc-200">Governance and payment</dt>
            <dd className="mt-1 text-zinc-400">
              Status: implemented for Level 4 reuse, link only. Payment follows measured proof. That commercial step is a design rule on the offer, the pilot, and the proof-to-payment journey. This page does not take a charge.
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

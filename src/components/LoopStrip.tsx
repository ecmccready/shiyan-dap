import Link from "next/link";
import {
  ADVANTAGE,
  ADVANTAGE_LIMIT,
  LOOP_LAYERS,
  RETENTION_SENTENCE,
  type LoopLayerId,
  versa,
} from "@/lib/semiconductor/loop";

/** Compact "where this step sits" strip for the engineering journey and the proof page.
 * Domain names that belong on the front door stay out of this strip.
 */
export default function LoopStrip({ here, note }: { here: LoopLayerId; note: string }) {
  return (
    <section data-loop-strip aria-labelledby="loop-strip-title" className="scroll-mt-8 space-y-3 rounded-xl border border-zinc-800 p-4">
      <h2 id="loop-strip-title" className="text-base font-semibold">Where this step sits in the loop</h2>
      <p className="text-sm text-zinc-300">{note}</p>
      <p className="text-sm text-zinc-400">{ADVANTAGE}</p>
      <ol aria-label="Each layer feeds the next" className="grid list-none gap-2 p-0 sm:grid-cols-3">
        {LOOP_LAYERS.map((layer) => {
          const current = layer.id === here;
          return (
            <li
              key={layer.feeds}
              data-feeds-next={layer.feeds}
              data-loop-layer={layer.id}
              aria-current={current ? "step" : undefined}
              className={`rounded-lg border p-3 ${current ? "border-emerald-700 bg-emerald-950/40" : "border-zinc-800"}`}
            >
              <h3 className="text-sm font-semibold">{layer.heading}</h3>
              <p className="mt-2 text-xs text-emerald-400">{layer.feedsNext}</p>
              <Link href={layer.href} className="mt-2 inline-block text-xs text-emerald-400 underline">
                {layer.link}
              </Link>
            </li>
          );
        })}
      </ol>
      <p className="text-sm text-zinc-300">{RETENTION_SENTENCE}</p>
      <p className="text-xs text-zinc-500">{ADVANTAGE_LIMIT}</p>
      <p className="text-xs text-zinc-500">
        Silicon records are retained in the Reference Data Ledger. Not yet physically validated. Power: {versa.power}.
        Robotics fixtures on this path are synthetic, and next-run reuse of them is planned.
        The Level 4 plant reuses a qualifying experience. This strip links the plant and does not modify it.{" "}
        <Link href="/#convergence-loop" className="text-emerald-400 underline">Full loop on the front door</Link>.
      </p>
    </section>
  );
}

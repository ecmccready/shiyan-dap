"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { runAB, type ABAction, type Actor } from "@/lib/actors";
import { Self, computeB, readOutcomes } from "@/lib/outcomes";

const A_BUTTONS: ABAction[] = ["PROPOSE", "LIST_INTENT", "REQUEST_RESPONSE"];
const B_BUTTONS: ABAction[] = ["ACK", "DECLINE", "REQUEST", "RETURN"];

export default function ABPage() {
  const [log, setLog] = useState<string[]>([]);
  const [z, setZ] = useState("");
  const [bAction, setBAction] = useState("");

  const refresh = () => {
    const self = Self(readOutcomes());
    const b = computeB(readOutcomes());
    setZ(self.z);
    setBAction(b.action);
  };

  useEffect(() => {
    refresh();
  }, []);

  const run = (actor: Actor, action: ABAction) => {
    const result = runAB({ actor, action, asset_id: "ab_loop" });
    setZ(result.z);
    setBAction(result.computed_b.action);
    setLog((rows) =>
      [
        `${actor} ${action} · seat ${result.seat} → z ${result.z} · computeB ${result.computed_b.action} · settlement unchanged · level3 false`,
        ...rows,
      ].slice(0, 12)
    );
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="A/B" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">slice_v8 · controlled B · declared capacity</p>
        <h1 className="text-3xl font-bold mb-3">A acts. Controlled B responds.</h1>
        <p className="text-zinc-400 mb-8">
          This seat can change z. It cannot write settlement. It is not an independent buyer. WAIT_EXTERNAL is correct while live B is unset.
        </p>

        <section className="bg-zinc-900/60 border border-emerald-800 rounded-2xl p-6 mb-6">
          <p className="text-xs text-emerald-400 mb-2">Self() · computeB()</p>
          <p className="text-xl">{z || "Observe."}</p>
          <p className="text-zinc-500 mt-2">
            Computed B {bAction} · live market B unset · level3 false
          </p>
        </section>

        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
            <p className="text-xs text-emerald-400 mb-2">Agent A · acts</p>
            <div className="flex flex-wrap gap-2">
              {A_BUTTONS.map((action) => (
                <button
                  key={action}
                  onClick={() => run("A", action)}
                  className="h-11 px-4 rounded-full bg-emerald-600 text-sm"
                >
                  {action}
                </button>
              ))}
            </div>
          </section>
          <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
            <p className="text-xs text-emerald-400 mb-2">Controlled B · session · not Level 3</p>
            <div className="flex flex-wrap gap-2">
              {B_BUTTONS.map((action) => (
                <button
                  key={action}
                  onClick={() => run("B", action)}
                  className="h-11 px-4 rounded-full border border-zinc-600 text-sm"
                >
                  {action}
                </button>
              ))}
            </div>
          </section>
        </div>

        <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-8">
          {log.length === 0 ? (
            <p className="text-zinc-500 text-sm">No exchange yet. A proposes first.</p>
          ) : (
            log.map((line, i) => (
              <p key={i} className="text-sm text-zinc-300 mb-2">
                {line}
              </p>
            ))
          )}
        </section>

        <div className="flex flex-wrap gap-3">
          <Link href="/measurements" className="h-11 px-6 rounded-full bg-emerald-600 text-sm inline-flex items-center">
            Learn
          </Link>
          <Link href="/protocol" className="h-11 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center">
            Protocol
          </Link>
          <Link href="/nfts" className="h-11 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center">
            Prove
          </Link>
        </div>
      </main>
    </div>
  );
}
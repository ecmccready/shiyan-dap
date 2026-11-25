import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { SCOPE } from "@/lib/domains/pipelines";
import { JOURNEY } from "@/lib/semiconductor/journey";
import summary from "../../fixtures/scp/versa-bitstream/summary.json";

const MAP = [
  ["Can my workload be improved?", "Workload characterization"],
  ["What is my current performance?", "Baseline measurement"],
  ["What can be optimized?", "4D-SCP exploration"],
  ["Can it map to FPGA?", "Synthesis and place-and-route workflow"],
  ["Does the implementation work?", "Bit-exact and hardware validation"],
  ["Can I reproduce the result?", "Versioned evidence and artifacts"],
] as const;

const STEPS = [
  "Bring a workload",
  "Establish baseline",
  "Run optimization",
  "Generate implementation evidence",
  "Validate on hardware",
  "Deliver the proof package",
] as const;

const combUsed = summary.seeds[0]?.trellis_comb.used ?? 0;
const combAvail = summary.seeds[0]?.trellis_comb.available ?? 0;
const combPct = combAvail > 0 ? ((combUsed / combAvail) * 100).toFixed(2) : "";
const routes = summary.seeds.filter((s) => s.exit_code === 0).length;
const exactFmax = summary.fmax_mhz_median;
const shownFmax = exactFmax.toFixed(2);

export default function SemiconductorDoor() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader brand="Shiyan DAP" section="Semiconductor" />
      <main className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        <header className="space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">SHIYAN DAP</p>
          <h1 className="text-4xl font-bold tracking-tight">Computational Intelligence. Semiconductor Proof.</h1>
          <p className="text-lg text-zinc-300">Optimize, verify and move computational designs toward hardware.</p>
          <p className="text-sm text-zinc-300">Powered by Aethel Node · 4D-SCP · FPGA implementation and measurement.</p>
          <p className="text-lg text-zinc-200">From Computational Workload to Verified Hardware.</p>
          <p className="max-w-3xl text-zinc-400">
            A semiconductor optimization and verification platform connecting intelligent computation, FPGA implementation and evidence-driven performance improvement.
          </p>
          <p className="text-sm text-zinc-400">Explore the engineering journey (Discover / Characterize / Optimize / Prove / Deliver).</p>
          <p className="text-sm text-zinc-500">Aethel Node · 4D-SCP · FPGA · Reference Data Engine</p>
        </header>

        <section className="grid gap-3 sm:grid-cols-5">
          {JOURNEY.map((s) => (
            <Link key={s.href} href={s.href} className="rounded-xl border border-zinc-800 p-4 hover:border-emerald-800">
              <p className="font-mono text-xs text-emerald-400">{s.n}</p>
              <h2 className="mt-1 font-semibold">{s.name}</h2>
              <p className="mt-2 text-xs text-zinc-400">Bring: {s.bring}</p>
              <p className="mt-1 text-xs text-zinc-300">Get: {s.get}</p>
            </Link>
          ))}
        </section>

        <section>
          <h2 className="text-xl font-semibold">Engineering problem</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Question</th>
                  <th className="py-2 font-medium">Work</th>
                </tr>
              </thead>
              <tbody className="text-zinc-200">
                {MAP.map(([q, a]) => (
                  <tr key={q} className="border-t border-zinc-800">
                    <td className="py-2 pr-4">{q}</td>
                    <td className="py-2">{a}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Journey</h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-zinc-300">
            {STEPS.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </section>

        <section className="rounded-2xl border border-zinc-700 p-5 space-y-3">
          <p className="text-xs uppercase tracking-widest text-emerald-400">Reference implementation</p>
          <h2 className="text-xl font-semibold">v0.1.31 Versa UART image</h2>
          <p className="text-sm text-zinc-400">
            Reduced configuration, ADDR_W 8, cfg_D 256. Not the full 35,438-COMB loop.
            Place-and-route on LFE5UM-45F. This is not a commercial chip claim.
          </p>
          <dl className="grid gap-3 sm:grid-cols-4 text-sm">
            <div>
              <dt className="text-zinc-500">Median Fmax</dt>
              <dd className="font-mono" title={`${exactFmax} MHz, the unrounded five-seed median`}>{shownFmax} MHz median</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Routing seeds</dt>
              <dd className="font-mono">{routes}/5</dd>
            </div>
            <div>
              <dt className="text-zinc-500">TRELLIS_COMB</dt>
              <dd className="font-mono" title={`${combUsed}/${combAvail} = ${combPct}%`}>{combUsed.toLocaleString("en-US")}/{combAvail.toLocaleString("en-US")} ({combPct}%)</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Packaged formats</dt>
              <dd className="font-mono">.bit, .spi.bit, .svf</dd>
            </div>
          </dl>
          <p className="text-sm text-zinc-300">
            Not yet physically validated. Place-and-route results. Physical board programming, real workload throughput and power measurement remain outstanding.
          </p>
          <p className="text-sm text-zinc-300">Power: needs real board.</p>
          <p className="text-xs text-zinc-500">
            Displayed median is {shownFmax} MHz, rounded to two decimal places from the measured {exactFmax} MHz in fixtures/scp/versa-bitstream/summary.json. The exact value is also on the ledger.
          </p>
          <p className="text-sm text-zinc-400">
            Status: reference (routed + simulated), physical verification pending. Measurement merge{" "}
            <a className="text-emerald-400 underline" href="https://github.com/ecmccready/shiyan-dap/pull/31">PR #31</a>
            {" "}and route{" "}
            <a className="text-emerald-400 underline" href="https://github.com/ecmccready/shiyan-dap/pull/30">PR #30</a>.
            Ledger: <Link className="text-emerald-400 underline" href="/workbench/reference-ledger">Reference Data Ledger</Link>.
          </p>
        </section>

        <section className="flex flex-wrap items-center gap-4">
          <Link href="/assess" className="inline-flex h-11 items-center rounded-full bg-emerald-500 px-5 text-sm font-medium text-black">
            Run a workload assessment
          </Link>
          <p className="text-sm text-zinc-300">Stage 01 Discover of the engineering journey.</p>
          <p className="text-sm text-zinc-500">
            Other domains stay in the selector. Semiconductor / FPGA is the Core default.
          </p>
        </section>

        <p className="text-sm text-zinc-400">{SCOPE}</p>

        <section className="grid gap-3 sm:grid-cols-2 text-sm text-zinc-400">
          <p><span className="text-zinc-200">Core boundary.</span> Semiconductor computation and verification is the primary product.</p>
          <p><span className="text-zinc-200">Computational boundary.</span> 4D-SCP owns representations and operations. Aethel Node orchestrates. Shiyan DAP records and evaluates.</p>
          <p><span className="text-zinc-200">Domain boundary.</span> Other domains are the fringe. They do not redefine the semiconductor core. They are reached from the domain selector, not from this page.</p>
          <p><span className="text-zinc-200">Evidence boundary.</span> A result is not promoted to a verified reference until it includes a physical measurement on the ECP5 Versa.</p>
        </section>
      </main>
    </div>
  );
}

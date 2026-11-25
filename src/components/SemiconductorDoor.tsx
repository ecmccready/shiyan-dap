import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import summary from "../../fixtures/scp/versa-bitstream/summary.json";

const STAGES = [
  { n: "01", name: "Discover", bring: "A computational workload and the constraint that matters.", get: "A written question the assessment can answer." },
  { n: "02", name: "Characterize", bring: "Inputs, size, and the current implementation.", get: "A description of what the workload actually does." },
  { n: "03", name: "Optimize", bring: "Permission to try 4D-SCP variants on that description.", get: "Candidates, including the ones that stop." },
  { n: "04", name: "Prove", bring: "The frozen candidate.", get: "Bit-exact checks and place-and-route evidence, labeled separately." },
  { n: "05", name: "Deploy or hand off", bring: "The evidence pack.", get: "A proof package. Physical programming is still outstanding." },
] as const;

const MAP = [
  ["Can my workload be improved?", "Workload characterization"],
  ["What is my current performance?", "Baseline measurement"],
  ["What can be optimized?", "4D-SCP exploration"],
  ["Can it map to FPGA?", "Synthesis and place-and-route workflow"],
  ["Does the implementation work?", "Bit-exact and hardware validation"],
  ["Can I reproduce the result?", "Versioned evidence and artifacts"],
] as const;

const JOURNEY = [
  "Bring a workload",
  "Establish baseline",
  "Run optimization",
  "Generate implementation evidence",
  "Validate on hardware",
  "Deliver the proof package",
] as const;

const comb = summary.seeds[0]?.trellis_comb.used;
const routes = summary.seeds.filter((s) => s.exit_code === 0).length;

export default function SemiconductorDoor() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader brand="Shiyan DAP" section="Semiconductor" />
      <main className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        <header className="space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Shiyan DAP</p>
          <h1 className="text-4xl font-bold tracking-tight">Computational Intelligence. Semiconductor Proof.</h1>
          <p className="text-lg text-zinc-300">Optimize, verify and move computational designs toward hardware.</p>
          <p className="text-lg text-zinc-200">From Computational Workload to Verified Hardware.</p>
          <p className="max-w-3xl text-zinc-400">
            A semiconductor optimization and verification platform connecting intelligent computation, FPGA implementation and evidence-driven performance improvement.
          </p>
          <p className="text-sm text-zinc-300">Powered by Aethel Node · 4D-SCP · FPGA implementation and measurement</p>
          <p className="text-sm text-zinc-500">Aethel Node · 4D-SCP · FPGA · Reference Data Engine</p>
        </header>

        <section className="grid gap-3 sm:grid-cols-5">
          {STAGES.map((s) => (
            <article key={s.n} className="rounded-xl border border-zinc-800 p-4">
              <p className="font-mono text-xs text-emerald-400">{s.n}</p>
              <h2 className="mt-1 font-semibold">{s.name}</h2>
              <p className="mt-2 text-xs text-zinc-400">Bring: {s.bring}</p>
              <p className="mt-1 text-xs text-zinc-300">Get: {s.get}</p>
            </article>
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
            {JOURNEY.map((step) => <li key={step}>{step}</li>)}
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
              <dd className="font-mono">{summary.fmax_mhz_median} MHz</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Routing seeds</dt>
              <dd className="font-mono">{routes}/5</dd>
            </div>
            <div>
              <dt className="text-zinc-500">TRELLIS_COMB</dt>
              <dd className="font-mono">{comb}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Packaged formats</dt>
              <dd className="font-mono">.bit, .spi.bit, .svf</dd>
            </div>
          </dl>
          <p className="text-sm text-zinc-300">
            Not yet physically validated. Place-and-route results. Physical board programming, real workload throughput and power measurement remain outstanding.
          </p>
          <p className="text-sm text-zinc-400">
            Measurement merge{" "}
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
          <p className="text-sm text-zinc-500">
            Other domains stay available in the domain selector. Each keeps its own inputs, rules, agents, measurements, and evidence format.
          </p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 text-sm text-zinc-400">
          <p><span className="text-zinc-200">Core boundary.</span> Semiconductor computation and verification.</p>
          <p><span className="text-zinc-200">Computational boundary.</span> 4D-SCP.</p>
          <p><span className="text-zinc-200">Domain boundary.</span> Verticals do not redefine the core.</p>
          <p><span className="text-zinc-200">Evidence boundary.</span> Results stay separately labeled until verified.</p>
        </section>
      </main>
    </div>
  );
}

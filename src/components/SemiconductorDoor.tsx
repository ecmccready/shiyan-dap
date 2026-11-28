import Link from "next/link";
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
const combRatio = combAvail > 0 ? (combUsed / combAvail) * 100 : 0;
const shownPct = combAvail > 0 ? combRatio.toFixed(1) : "";
const routes = summary.seeds.filter((s) => s.exit_code === 0).length;
const exactFmax = summary.fmax_mhz_median;
const shownFmax = exactFmax.toFixed(2);

/** Compute / Silicon layer of the Physical AI front door. Numbers come from the Versa summary fixture. */
export default function SemiconductorDoor() {
  return (
    <section id="compute-silicon" data-front-door-layer="compute-silicon" className="scroll-mt-8 space-y-8">
      <div className="space-y-3">
        <p className="font-mono text-xs text-emerald-400">Layer one</p>
        <h2 className="text-2xl font-semibold">Compute / Silicon</h2>
        <p className="max-w-3xl text-zinc-400">
          Semiconductor and FPGA hardware verification. 4D-SCP exploration, the ECP5 bitstream, measured Fmax, and bit-exact proofs.
          The engineering journey is Discover, Characterize, Optimize, Prove, and Deploy or hand off.
        </p>
        <p className="text-sm text-zinc-500">
          4D-SCP owns representations and operations. Aethel Node orchestrates. Shiyan DAP records and evaluates. 4D-SCP stays unwired from production routes.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        {JOURNEY.map((s) => (
          <Link key={s.href} href={s.href} className="rounded-xl border border-zinc-800 p-4 hover:border-emerald-800">
            <p className="font-mono text-xs text-emerald-400">{s.n}</p>
            <h3 className="mt-1 font-semibold">{s.name}</h3>
            <p className="mt-2 text-xs text-zinc-400">Bring: {s.bring}</p>
            <p className="mt-1 text-xs text-zinc-300">Get: {s.get}</p>
          </Link>
        ))}
      </div>

      <div>
        <h3 className="text-xl font-semibold">Engineering problem</h3>
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
      </div>

      <div>
        <h3 className="text-xl font-semibold">Journey</h3>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-zinc-300">
          {STEPS.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </div>

      <div data-reference-card className="space-y-3 rounded-2xl border border-zinc-700 p-5">
        <p className="text-xs uppercase tracking-widest text-emerald-400">Reference implementation</p>
        <h3 className="text-xl font-semibold">v0.1.31 Versa UART image</h3>
        <p className="text-sm text-zinc-400">
          Reduced configuration, ADDR_W 8, cfg_D 256. Not the full 35,438-COMB loop.
          Place-and-route on {summary.device}. This is not a commercial chip claim.
        </p>
        <dl className="grid gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-zinc-500">Median Fmax</dt>
            <dd className="font-mono" title={`${exactFmax} MHz, the unrounded five-seed median`}>{shownFmax} MHz</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Routing</dt>
            <dd className="font-mono">{routes}/{summary.seeds.length} seeds routed</dd>
          </div>
          <div>
            <dt className="text-zinc-500">TRELLIS_COMB utilization</dt>
            <dd className="font-mono" title={combAvail > 0 ? `${combUsed}/${combAvail} = ${combRatio}%` : undefined}>
              {combAvail > 0
                ? `${shownPct}% (${combUsed.toLocaleString("en-US")}/${combAvail.toLocaleString("en-US")} TRELLIS_COMB)`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Packaged formats</dt>
            <dd className="font-mono">.bit, .spi.bit, .svf</dd>
          </div>
        </dl>
        <p className="text-sm text-zinc-300">
          Not yet physically validated. Place-and-route results. Icarus checks on this image are bit-exact. Status: bitstream ready, awaiting physical board.
        </p>
        <p className="text-sm text-zinc-300">Power: {summary.power}.</p>
        <p className="text-xs text-zinc-500">
          Displayed median is {shownFmax} MHz, rounded to two decimal places from the measured {exactFmax} MHz in fixtures/scp/versa-bitstream/summary.json. Displayed utilization is {shownPct}%, rounded to one decimal place from {combUsed.toLocaleString("en-US")}/{combAvail.toLocaleString("en-US")} TRELLIS_COMB. The exact values are also on the ledger.
        </p>
        <p className="text-sm text-zinc-400">
          Status: reference (routed + simulated), physical verification pending. Measurement merge{" "}
          <a className="text-emerald-400 underline" href="https://github.com/ecmccready/shiyan-dap/pull/31">PR #31</a>
          {" "}and route{" "}
          <a className="text-emerald-400 underline" href="https://github.com/ecmccready/shiyan-dap/pull/30">PR #30</a>.
          Ledger: <Link className="text-emerald-400 underline" href="/workbench/reference-ledger">Reference Data Ledger</Link>.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Link href="/assess" className="inline-flex h-11 items-center rounded-full bg-emerald-500 px-5 text-sm font-medium text-black">
          Run a workload assessment
        </Link>
        <Link href="/workbench/compute-proof" className="text-sm text-emerald-400 underline">
          Computational Improvement Proof
        </Link>
        <p className="text-sm text-zinc-500">Stage 01 Discover starts the engineering journey. The proof page holds the measured table.</p>
      </div>
    </section>
  );
}

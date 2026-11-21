/** TEST ONLY. One selection run. The back-test uses the committed one-seed reports.
 * When fixtures/scp/v0119-industry-benchmark.json has five routed 45F seeds, the
 * gate opens and I is the measured relative Fmax gain. This script does not
 * place-and-route. Power is needs real board.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/scp-v0120-select-next.ts [--write]
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { canonicalJson } from "../src/scp/measurement";
import {
  bottleneck, improvementIndex, rankCandidates,
  type Candidate, type EvidenceRow, type LedgerEntry,
} from "../src/scp/optimizer/select";

const root = resolve(join(import.meta.dirname, ".."));
const WRITE = process.argv.includes("--write");
const V0119 = "fixtures/scp/v0119-industry-benchmark.json";
const CATALOG = "fixtures/scp/candidate-catalog.json";
const LEDGER = "fixtures/scp/optimization-ledger.jsonl";
const REPORTS = [
  "fixtures/scp/v0116-rtl-report.json",
  "fixtures/scp/v0117-rtl-report.json",
  "fixtures/scp/v0118-rtl-report.json",
] as const;

interface Pnr { fits?: boolean; fmax_mhz?: { clk?: number }; utilization?: { TRELLIS_COMB?: string }; seed?: number }
interface Report { synthesis?: { configs?: Record<string, { ecp5_45f_full_params?: { place_and_route?: Pnr } }> } }

function shaFile(rel: string): string {
  return createHash("sha256").update(readFileSync(join(root, rel))).digest("hex");
}

function rowsFrom(rel: string, want: (name: string) => EvidenceRow["role"] | null): EvidenceRow[] {
  const report = JSON.parse(readFileSync(join(root, rel), "utf8")) as Report;
  const configs = report.synthesis?.configs ?? {};
  const out: EvidenceRow[] = [];
  for (const [name, cfg] of Object.entries(configs)) {
    const role = want(name);
    const p = cfg.ecp5_45f_full_params?.place_and_route;
    if (!role || !p || typeof p.fmax_mhz?.clk !== "number" || typeof p.fits !== "boolean") continue;
    const lut = Number((p.utilization?.TRELLIS_COMB ?? "0/1").split("/")[0]);
    out.push({
      design: name,
      role,
      fmax_mhz: p.fmax_mhz.clk,
      lut,
      fits: p.fits,
      seeds: 1,
      bit_exact: true,
      source: `${rel}#/synthesis/configs/${name}/ecp5_45f_full_params/place_and_route/fmax_mhz/clk`,
    });
  }
  return out;
}

const asOfV0116 = (name: string): EvidenceRow["role"] | null => {
  if (name === "loop tenc_q W=4 L=8 -> tdec_w W=4") return "loop";
  if (name === "ref v0.1.13 scp4d_tdec_w W=4") return "decoder";
  if (name === "scp4d_tenc_q W=4 L=8") return "encoder";
  return null;
};
const asOfV0117 = (name: string): EvidenceRow["role"] | null => {
  if (name === "loop tenc_q W=4 L=8 -> tdec_r W=4") return "loop";
  if (name === "scp4d_tdec_r W=4") return "decoder";
  if (name === "ref v0.1.16 scp4d_tenc_q W=4 L=8") return "encoder";
  return null;
};

interface DesignFmax {
  fmax_mhz: { median: number } | null;
  seeds_45f?: { status: string }[];
  fits?: Record<string, boolean | null>;
}

function fiveSeedMedian(m: { designs?: Record<string, DesignFmax>; bit_exact?: { ok?: boolean } }, id: string): number | null {
  const d = m.designs?.[id];
  const routed = (d?.seeds_45f ?? []).filter((s) => s.status === "routed").length;
  if (!d?.fmax_mhz || routed !== 5 || d.fits?.["45F"] !== true) return null;
  return d.fmax_mhz.median;
}

export interface Selection {
  pending_v0119: boolean;
  power: "needs real board";
  catalog_sha256: string;
  report_sha256: Record<string, string>;
  backtest: { top: string; matches_historical_split: boolean; bottleneck: string; evidence: string[] };
  historical: {
    bottleneck: string;
    ranking_before: string[];
    ranking_after: string[];
    ranking_changed: boolean;
    chosen: string;
    I: 0;
  };
  live: {
    bottleneck: string;
    ranking_before: string[];
    ranking_after: string[];
    ranking_changed: boolean;
    chosen: string;
    executed_in_this_run: false;
    I: number;
    measured: null | {
      comparison: "retrospective";
      candidate: "pipeline_split";
      design: "tdec-s-w4";
      baseline: "tdec-r-w4";
      median_fmax_mhz: number;
      baseline_median_fmax_mhz: number;
      relative_gain: number;
      seeds: 5;
      bit_exact: boolean;
      fits_45f: true;
      source: string;
    };
  };
}

export function runSelection(): Selection {
  const catalog = JSON.parse(readFileSync(join(root, CATALOG), "utf8")) as { candidates: Candidate[] };
  const historical = ["decoder_variant", "pipeline_split"];
  const beforeRows = rowsFrom(REPORTS[0], asOfV0116);
  const beforeLimit = bottleneck(beforeRows);
  const back = rankCandidates(catalog.candidates, beforeLimit, []);
  const top = back[0]?.id ?? "";
  const afterRows = rowsFrom(REPORTS[1], asOfV0117);
  const v0116Loop = beforeRows.find((r) => r.role === "loop");
  const v0117Loop = afterRows.find((r) => r.role === "loop");
  if (!v0116Loop || !v0117Loop) throw new Error("loop fmax missing from a committed report");
  const histLedger: LedgerEntry[] = [{ candidate: "decoder_variant", accepted: v0117Loop.fmax_mhz > v0116Loop.fmax_mhz }];
  const afterLimit = bottleneck(afterRows);
  const histBefore = rankCandidates(catalog.candidates, afterLimit, []);
  const histAfter = rankCandidates(catalog.candidates, afterLimit, histLedger);

  const manifestPath = join(root, V0119);
  let measured: Selection["live"]["measured"] = null;
  let liveLimit = afterLimit;
  let liveLedger = histLedger;
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { designs?: Record<string, DesignFmax>; bit_exact?: { ok?: boolean } };
    const split = fiveSeedMedian(manifest, "tdec-s-w4");
    const prior = fiveSeedMedian(manifest, "tdec-r-w4");
    const enc = fiveSeedMedian(manifest, "tenc-q-w4l8");
    const bitExact = manifest.bit_exact?.ok === true;
    if (split !== null && prior !== null && enc !== null && bitExact) {
      const gain = split / prior - 1;
      measured = {
        comparison: "retrospective",
        candidate: "pipeline_split",
        design: "tdec-s-w4",
        baseline: "tdec-r-w4",
        median_fmax_mhz: split,
        baseline_median_fmax_mhz: prior,
        relative_gain: gain,
        seeds: 5,
        bit_exact: true,
        fits_45f: true,
        source: `${V0119}#/designs/tdec-s-w4/fmax_mhz/median`,
      };
      const rows: EvidenceRow[] = [
        { design: "tdec-s-w4", role: "decoder", fmax_mhz: split, lut: 0, fits: true, seeds: 5, bit_exact: true, source: measured.source },
        { design: "tenc-q-w4l8", role: "encoder", fmax_mhz: enc, lut: 0, fits: true, seeds: 5, bit_exact: true, source: `${V0119}#/designs/tenc-q-w4l8/fmax_mhz/median` },
      ];
      liveLimit = bottleneck(rows);
      const variant = fiveSeedMedian(manifest, "tdec-w-w4");
      liveLedger = [
        { candidate: "decoder_variant", accepted: variant !== null && prior > variant },
        { candidate: "pipeline_split", accepted: gain > 0 },
      ];
    }
  }
  const liveBefore = rankCandidates(catalog.candidates, liveLimit, []);
  const liveAfter = rankCandidates(catalog.candidates, liveLimit, liveLedger);
  const I = measured ? improvementIndex(measured.bit_exact, measured.fits_45f, measured.seeds, measured.relative_gain) : 0;
  return {
    pending_v0119: measured === null,
    power: "needs real board",
    catalog_sha256: shaFile(CATALOG),
    report_sha256: Object.fromEntries(REPORTS.map((r) => [r, shaFile(r)])),
    backtest: {
      top,
      matches_historical_split: historical.includes(top),
      bottleneck: beforeLimit.name,
      evidence: beforeLimit.evidence,
    },
    historical: {
      bottleneck: afterLimit.name,
      ranking_before: histBefore.map((r) => r.id),
      ranking_after: histAfter.map((r) => r.id),
      ranking_changed: histBefore.map((r) => r.id).join(",") !== histAfter.map((r) => r.id).join(","),
      chosen: histAfter[0]?.id ?? "",
      I: 0,
    },
    live: {
      bottleneck: liveLimit.name,
      ranking_before: liveBefore.map((r) => r.id),
      ranking_after: liveAfter.map((r) => r.id),
      ranking_changed: liveBefore.map((r) => r.id).join(",") !== liveAfter.map((r) => r.id).join(","),
      chosen: liveAfter[0]?.id ?? "",
      executed_in_this_run: false,
      I,
      measured,
    },
  };
}

const sel = runSelection();
const v16 = rowsFrom(REPORTS[0], asOfV0116).find((r) => r.role === "loop");
const v17 = rowsFrom(REPORTS[1], asOfV0117).find((r) => r.role === "loop");
const historicalEntry = {
  candidate: "decoder_variant",
  executed_in_this_run: false,
  reason: "One-seed back-test. The measured clocks are the committed v0.1.16 and v0.1.17 report fields. No place-and-route was run by this script.",
  power: "needs real board",
  predicted: "hypothesis: raise the decoder clock. The frozen catalog has no numeric prediction.",
  measured_loop_fmax_mhz_v0116: v16?.fmax_mhz,
  measured_loop_fmax_mhz_v0117: v17?.fmax_mhz,
  measured_source_v0116: v16?.source,
  measured_source_v0117: v17?.source,
  accepted: (v17?.fmax_mhz ?? 0) > (v16?.fmax_mhz ?? 0),
  seeds: 1,
  I: 0,
  backtest_top: sel.backtest.top,
  backtest_matches_historical_split: sel.backtest.matches_historical_split,
  ranking_before: sel.historical.ranking_before,
  ranking_after: sel.historical.ranking_after,
};
const liveEntry = {
  candidate: sel.live.measured?.candidate ?? sel.live.chosen,
  executed_in_this_run: false,
  comparison: "retrospective",
  reason: sel.pending_v0119
    ? "v0.1.19 manifest has no five-seed routed median for tdec-s-w4, tdec-r-w4 and tenc-q-w4l8."
    : "Retrospective comparison of two designs already in the v0.1.19 manifest (tdec-s-w4 versus tdec-r-w4). Not a live prediction: the catalog never recorded a number for pipeline_split before those seeds ran. This script did not place-and-route.",
  power: "needs real board",
  predicted: "No pre-registered numeric prediction. The frozen catalog says the effect is a hypothesis, not a measurement.",
  measured: sel.live.measured,
  chosen_next: sel.live.chosen,
  accepted: (sel.live.measured?.relative_gain ?? 0) > 0,
  seeds: sel.live.measured?.seeds ?? 0,
  I: sel.live.I,
  bottleneck: sel.live.bottleneck,
  ranking_after: sel.live.ranking_after,
};
console.log(JSON.stringify(JSON.parse(canonicalJson(sel)), null, 2));
console.log("ledger", JSON.stringify(liveEntry));
if (WRITE) writeFileSync(join(root, LEDGER), `${JSON.stringify(historicalEntry)}\n${JSON.stringify(liveEntry)}\n`);

/** TEST ONLY. One selection run over evidence that already exists on main.
 * There is no v0.1.19 manifest here, so the five-seed gate stays closed and no
 * place-and-route is started. Power is needs real board.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/scp-v0120-select-next.ts [--write]
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { canonicalJson } from "../src/scp/measurement";
import {
  bottleneck, rankCandidates,
  type Candidate, type EvidenceRow, type LedgerEntry,
} from "../src/scp/optimizer/select";

const root = resolve(join(import.meta.dirname, ".."));
const WRITE = process.argv.includes("--write");
const V0119 = "fixtures/scp/v0119-benchmark-manifest.json";
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

export interface Selection {
  pending_v0119: boolean;
  power: "needs real board";
  catalog_sha256: string;
  report_sha256: Record<string, string>;
  backtest: { top: string; matches_historical_split: boolean; bottleneck: string; evidence: string[] };
  live: {
    bottleneck: string;
    ranking_before: string[];
    ranking_after: string[];
    ranking_changed: boolean;
    chosen: string;
    executed_in_this_run: false;
    I: 0;
  };
}

export function runSelection(): Selection {
  if (existsSync(join(root, V0119))) {
    throw new Error("v0.1.19 manifest is present; this run refuses to mix it with task 8, which is deferred");
  }
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
  const ledger: LedgerEntry[] = [{ candidate: "decoder_variant", accepted: v0117Loop.fmax_mhz > v0116Loop.fmax_mhz }];
  const afterLimit = bottleneck(afterRows);
  const before = rankCandidates(catalog.candidates, afterLimit, []);
  const after = rankCandidates(catalog.candidates, afterLimit, ledger);
  return {
    pending_v0119: true,
    power: "needs real board",
    catalog_sha256: shaFile(CATALOG),
    report_sha256: Object.fromEntries(REPORTS.map((r) => [r, shaFile(r)])),
    backtest: {
      top,
      matches_historical_split: historical.includes(top),
      bottleneck: beforeLimit.name,
      evidence: beforeLimit.evidence,
    },
    live: {
      bottleneck: afterLimit.name,
      ranking_before: before.map((r) => r.id),
      ranking_after: after.map((r) => r.id),
      ranking_changed: before.map((r) => r.id).join(",") !== after.map((r) => r.id).join(","),
      chosen: after[0]?.id ?? "",
      executed_in_this_run: false,
      I: 0,
    },
  };
}

const sel = runSelection();
const v16 = rowsFrom(REPORTS[0], asOfV0116).find((r) => r.role === "loop");
const v17 = rowsFrom(REPORTS[1], asOfV0117).find((r) => r.role === "loop");
const entry = {
  candidate: "decoder_variant",
  executed_in_this_run: false,
  reason: "pending v0.1.19 data; task 8 deferred. The measured clocks are the committed v0.1.16 and v0.1.17 report fields. No place-and-route was run.",
  power: "needs real board",
  predicted: "hypothesis: raise the decoder clock. Not a measurement.",
  measured_loop_fmax_mhz_v0116: v16?.fmax_mhz,
  measured_loop_fmax_mhz_v0117: v17?.fmax_mhz,
  measured_source_v0116: v16?.source,
  measured_source_v0117: v17?.source,
  accepted: (v17?.fmax_mhz ?? 0) > (v16?.fmax_mhz ?? 0),
  seeds: 1,
  I: 0,
  backtest_top: sel.backtest.top,
  backtest_matches_historical_split: sel.backtest.matches_historical_split,
  ranking_before: sel.live.ranking_before,
  ranking_after: sel.live.ranking_after,
};
console.log(JSON.stringify(JSON.parse(canonicalJson(sel)), null, 2));
console.log("ledger", JSON.stringify(entry));
if (WRITE) writeFileSync(join(root, LEDGER), `${JSON.stringify(entry)}\n`);

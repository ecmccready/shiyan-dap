/**
 * Design set for the v0.1.19 ECP5 benchmark.
 * Every RTL encoder, decoder and loop module, at the configuration the spec uses
 * for that module's comparison. W = 2 and W = 4 are both included where the
 * datapath width changes the netlist that earlier reports compared. Other (W, L)
 * settings of the same module are the same RTL and are not re-placed here.
 * Cycle counts are read from the committed simulation reports. This file does not
 * contain an Fmax.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const STREAM_T = "env-16x16x2-T64-temporal-last";
export const STREAM_R = "env-16x16x2-T64-relations-last";

export const READ_FILES = [
  "hw/scp4d/rtl/scp4d_tdec.v",
  "hw/scp4d/rtl/scp4d_rdec.v",
  "hw/scp4d/rtl/scp4d_fe_w.v",
  "hw/scp4d/rtl/scp4d_tdec_w.v",
  "hw/scp4d/rtl/scp4d_rdec_w.v",
  "hw/scp4d/rtl/scp4d_fe_r.v",
  "hw/scp4d/rtl/scp4d_fe_r_share.v",
  "hw/scp4d/rtl/scp4d_tdec_s_w4_bram.v",
  "hw/scp4d/rtl/scp4d_tdec_r.v",
  "hw/scp4d/rtl/scp4d_tdec_s.v",
  "hw/scp4d/rtl/scp4d_tenc_w.v",
  "hw/scp4d/rtl/scp4d_tenc_p.v",
  "hw/scp4d/rtl/scp4d_tenc_q.v",
  "hw/scp4d/rtl/scp4d_tenc_q_w4l8_bram.v",
  "hw/scp4d/synth/scp4d_pnr_wrap.v",
  "hw/scp4d/synth/scp4d_tenc_wrap.v",
  "hw/scp4d/synth/scp4d_tenc_p_wrap.v",
  "hw/scp4d/synth/scp4d_tenc_q_wrap.v",
  "hw/scp4d/synth/scp4d_tdec_r_wrap.v",
  "hw/scp4d/synth/scp4d_tdec_s_wrap.v",
  "hw/scp4d/rtl/scp4d_ede.v",
  "hw/scp4d/rtl/scp4d_fsd.v",
  "hw/scp4d/rtl/scp4d_k1_tap.v",
  "hw/scp4d/synth/scp4d_ede_wrap.v",
  "hw/scp4d/rtl/scp4d_hybrid.v",
  "hw/scp4d/synth/scp4d_hybrid_wrap.v",
  "hw/scp4d/synth/scp4d_loop_hybrid_wrap.v",
  "hw/scp4d/rtl/scp4d_ede_pipe.v",
  "hw/scp4d/rtl/scp4d_hybrid_pipe.v",
  "hw/scp4d/synth/scp4d_loop_k1pipe_wrap.v",
  "hw/scp4d/synth/scp4d_loop_k1bare_wrap.v",
  "hw/scp4d/synth/scp4d_loop_fsdonly_wrap.v",
  "hw/scp4d/rtl/scp4d_fe_r_fast.v",
  "hw/scp4d/rtl/scp4d_tdec_s_w4_fast.v",
  "hw/scp4d/synth/scp4d_loop_k1fast_wrap.v",
  "hw/scp4d/rtl/scp4d_hybrid_fast.v",
  "hw/scp4d/synth/scp4d_loop_hyfast_wrap.v",
] as const;

export type Kind = "encoder" | "decoder" | "loop" | "decision";
export type SetParam = { name: string; value: string };

export type Design = {
  id: string;
  kind: Kind;
  milestone: string;
  top: string;
  sets: readonly SetParam[];
  /** Closed loops name the encoder and decoder placed at the same configuration. */
  composedOf?: readonly string[];
  workload: "tdec" | "tdec_w" | "rdec" | "rdec_w" | "tenc_w" | "tenc_p" | "tenc_q" | "loop_w" | "loop_p" | "loop_q" | "loop_r" | "loop_s" | "ede" | "ede_rel" | "fsd" | "loop_ede" | "hybrid";
  /** W or the cfg key such as W4L8. */
  field: string;
};

export const DESIGNS: readonly Design[] = [
  { id: "tdec", kind: "decoder", milestone: "v0.1.11", top: "wrap_tdec", sets: [], workload: "tdec", field: "cycles" },
  { id: "tdec-w-w2", kind: "decoder", milestone: "v0.1.13", top: "wrap_tdec_w", sets: [{ name: "W", value: "2" }], workload: "tdec_w", field: "W2" },
  { id: "tdec-w-w4", kind: "decoder", milestone: "v0.1.13", top: "wrap_tdec_w", sets: [{ name: "W", value: "4" }], workload: "tdec_w", field: "W4" },
  { id: "tdec-r-w2", kind: "decoder", milestone: "v0.1.17", top: "wrap_tdec_r", sets: [{ name: "W", value: "2" }], workload: "tdec_w", field: "W2" },
  { id: "tdec-r-w4", kind: "decoder", milestone: "v0.1.17", top: "wrap_tdec_r", sets: [{ name: "W", value: "4" }], workload: "tdec_w", field: "W4" },
  { id: "tdec-s-w2", kind: "decoder", milestone: "v0.1.18", top: "wrap_tdec_s", sets: [{ name: "W", value: "2" }], workload: "tdec_w", field: "W2" },
  { id: "tdec-s-w4", kind: "decoder", milestone: "v0.1.18", top: "wrap_tdec_s", sets: [{ name: "W", value: "4" }], workload: "tdec_w", field: "W4" },
  { id: "rdec", kind: "decoder", milestone: "v0.1.12", top: "wrap_rdec", sets: [], workload: "rdec", field: "cycles" },
  { id: "rdec-w-w2", kind: "decoder", milestone: "v0.1.13", top: "wrap_rdec_w", sets: [{ name: "W", value: "2" }], workload: "rdec_w", field: "W2" },
  { id: "rdec-w-w4", kind: "decoder", milestone: "v0.1.13", top: "wrap_rdec_w", sets: [{ name: "W", value: "4" }], workload: "rdec_w", field: "W4" },
  { id: "tenc-w-w2l8", kind: "encoder", milestone: "v0.1.14", top: "wrap_tenc_w", sets: [{ name: "W", value: "2" }, { name: "L", value: "8" }], workload: "tenc_w", field: "W2L8" },
  { id: "tenc-p-w2l8", kind: "encoder", milestone: "v0.1.15", top: "wrap_tenc_p", sets: [{ name: "W", value: "2" }, { name: "L", value: "8" }], workload: "tenc_p", field: "W2L8" },
  { id: "tenc-p-w4l8", kind: "encoder", milestone: "v0.1.15", top: "wrap_tenc_p", sets: [{ name: "W", value: "4" }, { name: "L", value: "8" }], workload: "tenc_p", field: "W4L8" },
  { id: "tenc-q-w2l8", kind: "encoder", milestone: "v0.1.16", top: "wrap_tenc_q", sets: [{ name: "W", value: "2" }, { name: "L", value: "8" }], workload: "tenc_q", field: "W2L8" },
  { id: "tenc-q-w4l8", kind: "encoder", milestone: "v0.1.16", top: "wrap_tenc_q", sets: [{ name: "W", value: "4" }, { name: "L", value: "8" }], workload: "tenc_q", field: "W4L8" },
  { id: "loop-w-w2l8", kind: "loop", milestone: "v0.1.14", top: "wrap_loop", sets: [{ name: "L", value: "8" }], composedOf: ["tenc-w-w2l8", "tdec-w-w2"], workload: "loop_w", field: "W2L8" },
  { id: "loop-p-w4l8", kind: "loop", milestone: "v0.1.15", top: "wrap_loop_p", sets: [{ name: "W", value: "4" }, { name: "L", value: "8" }], composedOf: ["tenc-p-w4l8", "tdec-w-w4"], workload: "loop_p", field: "W4L8" },
  { id: "loop-q-w4l8", kind: "loop", milestone: "v0.1.16", top: "wrap_loop_q", sets: [{ name: "W", value: "4" }, { name: "L", value: "8" }], composedOf: ["tenc-q-w4l8", "tdec-w-w4"], workload: "loop_q", field: "W4L8" },
  { id: "loop-r-w4l8", kind: "loop", milestone: "v0.1.17", top: "wrap_loop_r", sets: [{ name: "W", value: "4" }, { name: "L", value: "8" }], composedOf: ["tenc-q-w4l8", "tdec-r-w4"], workload: "loop_r", field: "W4L8" },
  { id: "loop-s-w2l8", kind: "loop", milestone: "v0.1.18", top: "wrap_loop_s", sets: [{ name: "W", value: "2" }, { name: "L", value: "8" }], composedOf: ["tenc-q-w2l8", "tdec-s-w2"], workload: "loop_s", field: "W2L8" },
  { id: "loop-s-w4l8", kind: "loop", milestone: "v0.1.18", top: "wrap_loop_s", sets: [{ name: "W", value: "4" }, { name: "L", value: "8" }], composedOf: ["tenc-q-w4l8", "tdec-s-w4"], workload: "loop_s", field: "W4L8" },
  { id: "ede-temporal", kind: "decision", milestone: "v0.1.20", top: "wrap_ede", sets: [{ name: "REL", value: "0" }], workload: "ede", field: "cycles" },
  { id: "ede-relations", kind: "decision", milestone: "v0.1.20", top: "wrap_ede", sets: [{ name: "REL", value: "1" }], workload: "ede_rel", field: "cycles" },
  { id: "fsd", kind: "decision", milestone: "v0.1.20", top: "wrap_fsd", sets: [], workload: "fsd", field: "cycles" },
  { id: "loop-ede-w4l8", kind: "loop", milestone: "v0.1.20", top: "wrap_loop_ede", sets: [{ name: "W", value: "4" }, { name: "L", value: "8" }], composedOf: ["tenc-q-w4l8", "tdec-s-w4", "ede-temporal"], workload: "loop_ede", field: "cycles" },
  { id: "hybrid", kind: "decision", milestone: "v0.1.23", top: "wrap_hybrid", sets: [{ name: "A", value: "8" }, { name: "REL", value: "0" }], workload: "hybrid", field: "cycles" },
  { id: "hybrid-a10", kind: "decision", milestone: "v0.1.23", top: "wrap_hybrid", sets: [{ name: "A", value: "10" }, { name: "REL", value: "0" }], workload: "hybrid", field: "cycles" },
  { id: "hybrid-a12", kind: "decision", milestone: "v0.1.23", top: "wrap_hybrid", sets: [{ name: "A", value: "12" }, { name: "REL", value: "0" }], workload: "hybrid", field: "cycles" },
  { id: "loop-hybrid-w4l8", kind: "loop", milestone: "v0.1.23", top: "wrap_loop_hybrid", sets: [{ name: "W", value: "4" }, { name: "L", value: "8" }, { name: "A", value: "11" }], workload: "hybrid", field: "cycles" },
  { id: "loop-k1pipe-w4l8", kind: "loop", milestone: "v0.1.24", top: "wrap_loop_k1pipe", sets: [{ name: "W", value: "4" }, { name: "L", value: "8" }, { name: "A", value: "11" }], workload: "hybrid", field: "cycles" },
  { id: "loop-k1bare-w4l8", kind: "loop", milestone: "v0.1.25", top: "wrap_loop_k1bare", sets: [{ name: "W", value: "4" }, { name: "L", value: "8" }, { name: "A", value: "11" }], workload: "hybrid", field: "cycles" },
  { id: "loop-fsdonly-w4l8", kind: "loop", milestone: "v0.1.25", top: "wrap_loop_fsdonly", sets: [{ name: "W", value: "4" }, { name: "L", value: "8" }, { name: "A", value: "11" }], workload: "hybrid", field: "cycles" },
  { id: "loop-k1fast-w4l8", kind: "loop", milestone: "v0.1.25", top: "wrap_loop_k1fast", sets: [{ name: "W", value: "4" }, { name: "L", value: "8" }, { name: "A", value: "11" }], workload: "hybrid", field: "cycles" },
  { id: "loop-hyfast-w4l8", kind: "loop", milestone: "v0.1.26", top: "wrap_loop_hyfast", sets: [{ name: "W", value: "4" }, { name: "L", value: "8" }, { name: "A", value: "11" }], workload: "hybrid", field: "cycles" },
];

export type Workload = {
  stream: string;
  element_frames: number;
  cycles: number;
  /** Threshold compares in the K1 simulation. Absent for the codec designs. */
  evals?: number;
  source_report: string;
  source_field: string;
};

const int = (v: unknown, what: string): number => {
  if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) throw new Error(`${what} is not a positive integer (${String(v)})`);
  return v;
};

function load(root: string, rel: string): any {
  return JSON.parse(readFileSync(join(root, rel), "utf8"));
}

function frames(root: string, section: "temporal_only" | "relations", stream: string): number {
  const rows = load(root, "fixtures/scp/v0113-rtl-report.json").comparison[section] as { stream: string; element_frames: number }[];
  const row = rows.find((r) => r.stream === stream);
  return int(row?.element_frames, `element_frames ${stream}`);
}

function measuredCycles(root: string, report: string, list: "decoder" | "encoder" | "loop" | "array", id: string, field: string): number {
  const measured = load(root, report).measured;
  const rows = (Array.isArray(measured) ? measured : measured[list]) as Record<string, unknown>[];
  if (!Array.isArray(rows)) throw new Error(`${report} measured.${list} is not an array`);
  const row = rows.find((r) => r.id === id || r.key === id);
  if (!row) throw new Error(`${report} has no row ${id}`);
  if (field === "cycles") return int(row.cycles, `${id} cycles`);
  const cell = row[field] as { cycles?: number } | undefined;
  return int(cell?.cycles, `${id} ${field} cycles`);
}

/** Committed simulation cycles for the named stream. Throws if the report does not have them. */
export function workloadFor(root: string, d: Design): Workload {
  if (d.workload === "tdec") {
    return {
      stream: STREAM_T, element_frames: frames(root, "temporal_only", STREAM_T),
      cycles: measuredCycles(root, "fixtures/scp/v0111-rtl-report.json", "array", STREAM_T, "cycles"),
      source_report: "fixtures/scp/v0111-rtl-report.json", source_field: `measured[id=${STREAM_T}].cycles`,
    };
  }
  if (d.workload === "rdec") {
    return {
      stream: STREAM_R, element_frames: frames(root, "relations", STREAM_R),
      cycles: measuredCycles(root, "fixtures/scp/v0112-rtl-report.json", "array", STREAM_R, "cycles"),
      source_report: "fixtures/scp/v0112-rtl-report.json", source_field: `measured[id=${STREAM_R}].cycles`,
    };
  }
  if (d.workload === "hybrid") {
    if (d.id === "loop-hyfast-w4l8") {
      const sim = load(root, "fixtures/scp/v0126-heldout.json") as { rows: { addr_w: number; cycles: number; evals: number }[] };
      const cell = sim.rows.find((r) => r.addr_w === 12);
      return {
        stream: "held-out-seed9-a12-hyfast",
        element_frames: 2048 * 64,
        cycles: int(cell?.cycles, "hyfast cycles"),
        evals: int(cell?.evals, "hyfast evals"),
        source_report: "fixtures/scp/v0126-heldout.json",
        source_field: "rows[addr_w=12].cycles",
      };
    }
    if (d.id === "loop-k1fast-w4l8") {
      const sim = load(root, "fixtures/scp/v0125-candidate.json") as { rows: { addr_w: number; cycles: number; evals: number }[] };
      const cell = sim.rows.find((r) => r.addr_w === 12);
      return {
        stream: "held-out-seed9-a12-k1fast",
        element_frames: 2048 * 64,
        cycles: int(cell?.cycles, "k1fast cycles"),
        evals: int(cell?.evals, "k1fast evals"),
        source_report: "fixtures/scp/v0125-candidate.json",
        source_field: "rows[addr_w=12].cycles",
      };
    }
    if (d.id === "loop-k1bare-w4l8" || d.id === "loop-fsdonly-w4l8") {
      const sim = load(root, "fixtures/scp/v0125-baselines.json") as { rows: { engine: string; addr_w: number; cycles: number; evals: number }[] };
      const engine = d.id === "loop-k1bare-w4l8" ? "k1bare" : "fsdonly";
      const cell = sim.rows.find((r) => r.engine === engine && r.addr_w === 12);
      return {
        stream: `held-out-seed9-a12-${engine}`,
        element_frames: 2048 * 64,
        cycles: int(cell?.cycles, `${engine} cycles`),
        evals: int(cell?.evals, `${engine} evals`),
        source_report: "fixtures/scp/v0125-baselines.json",
        source_field: `rows[engine=${engine},addr_w=12].cycles`,
      };
    }
    if (d.id === "loop-k1pipe-w4l8") {
      const sim = load(root, "fixtures/scp/v0124-measure.json") as { rows: { addr_w: number; pipe_cycles: number; pipe_evals: number }[] };
      const cell = sim.rows.find((r) => r.addr_w === 12);
      return {
        stream: "held-out-seed9-a12-k1pipe",
        element_frames: 2048 * 64,
        cycles: int(cell?.pipe_cycles, "k1pipe cycles"),
        evals: int(cell?.pipe_evals, "k1pipe evals"),
        source_report: "fixtures/scp/v0124-measure.json",
        source_field: "rows[addr_w=12].pipe_cycles",
      };
    }
    if (d.id === "loop-hybrid-w4l8") {
      const sim = load(root, "fixtures/scp/v0123b-loop-sim.json") as { rows: { addr_w: number; hybrid_cycles: number; hybrid_evals: number }[] };
      const cell = sim.rows.find((r) => r.addr_w === 12);
      return {
        stream: "held-out-seed9-a12-loop",
        element_frames: 2048 * 64,
        cycles: int(cell?.hybrid_cycles, "hybrid loop cycles"),
        evals: int(cell?.hybrid_evals, "hybrid loop evals"),
        source_report: "fixtures/scp/v0123b-loop-sim.json",
        source_field: "rows[addr_w=12].hybrid_cycles",
      };
    }
    const aw = d.id === "hybrid-a12" ? 12 : d.id === "hybrid-a10" ? 10 : 8;
    const D = aw >= 12 ? 2048 : 1 << aw;
    const sim = load(root, "fixtures/scp/v0123-hybrid-sim.json") as { held_out: { addr_w: number; hybrid_cycles: number; hybrid_evals: number }[] };
    const cell = sim.held_out.find((r) => r.addr_w === aw);
    return {
      stream: `held-out-seed9-a${aw}`,
      element_frames: D * 64,
      cycles: int(cell?.hybrid_cycles, "hybrid cycles"),
      evals: int(cell?.hybrid_evals, "hybrid evals"),
      source_report: "fixtures/scp/v0123-hybrid-sim.json",
      source_field: `held_out[addr_w=${aw}].hybrid_cycles`,
    };
  }
  if (d.workload === "ede" || d.workload === "ede_rel" || d.workload === "fsd" || d.workload === "loop_ede") {
    const file = "fixtures/scp/v0120-k1-env.json";
    const row = load(root, file) as {
      ede_temporal: { cycles: number; evals: number };
      ede_relations: { cycles: number; evals: number };
      fsd: { cycles: number; evals: number };
      loop_ede_w4l8: { cycles: number; evals: number };
    };
    const key = d.workload === "ede" ? "ede_temporal" : d.workload === "ede_rel" ? "ede_relations" : d.workload === "fsd" ? "fsd" : "loop_ede_w4l8";
    const cell = row[key];
    return {
      stream: STREAM_T,
      element_frames: frames(root, "temporal_only", STREAM_T),
      cycles: int(cell.cycles, `${key} cycles`),
      evals: int(cell.evals, `${key} evals`),
      source_report: file,
      source_field: `${key}.cycles`,
    };
  }
  const temporalKey = `tdec_w:${STREAM_T}`;
  const relKey = `rdec_w:${STREAM_R}`;
  const table: Record<Design["workload"], { report: string; list: "decoder" | "encoder" | "loop"; id: string; stream: string; section: "temporal_only" | "relations" }> = {
    tdec: { report: "", list: "decoder", id: "", stream: STREAM_T, section: "temporal_only" },
    rdec: { report: "", list: "decoder", id: "", stream: STREAM_R, section: "relations" },
    tdec_w: { report: d.milestone === "v0.1.18" ? "fixtures/scp/v0118-rtl-report.json" : d.milestone === "v0.1.17" ? "fixtures/scp/v0117-rtl-report.json" : "fixtures/scp/v0113-rtl-report.json", list: "decoder", id: temporalKey, stream: STREAM_T, section: "temporal_only" },
    rdec_w: { report: "fixtures/scp/v0113-rtl-report.json", list: "decoder", id: relKey, stream: STREAM_R, section: "relations" },
    tenc_w: { report: "fixtures/scp/v0114-rtl-report.json", list: "encoder", id: STREAM_T, stream: STREAM_T, section: "temporal_only" },
    tenc_p: { report: "fixtures/scp/v0115-rtl-report.json", list: "encoder", id: STREAM_T, stream: STREAM_T, section: "temporal_only" },
    tenc_q: { report: "fixtures/scp/v0116-rtl-report.json", list: "encoder", id: STREAM_T, stream: STREAM_T, section: "temporal_only" },
    loop_w: { report: "fixtures/scp/v0114-rtl-report.json", list: "loop", id: STREAM_T, stream: STREAM_T, section: "temporal_only" },
    loop_p: { report: "fixtures/scp/v0115-rtl-report.json", list: "loop", id: STREAM_T, stream: STREAM_T, section: "temporal_only" },
    loop_q: { report: "fixtures/scp/v0116-rtl-report.json", list: "loop", id: STREAM_T, stream: STREAM_T, section: "temporal_only" },
    loop_r: { report: "fixtures/scp/v0117-rtl-report.json", list: "loop", id: STREAM_T, stream: STREAM_T, section: "temporal_only" },
    loop_s: { report: "fixtures/scp/v0118-rtl-report.json", list: "loop", id: STREAM_T, stream: STREAM_T, section: "temporal_only" },
  };
  const t = table[d.workload];
  return {
    stream: t.stream,
    element_frames: frames(root, t.section, t.stream),
    cycles: measuredCycles(root, t.report, t.list, t.id, d.field),
    source_report: t.report,
    source_field: `measured.${t.list}[id=${t.id}].${d.field}.cycles`,
  };
}

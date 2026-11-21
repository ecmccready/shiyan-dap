/**
 * ScpMeasurement for v0.1.20. Compatible with { e0, e, delta_e } (spec §6):
 * e0 is the error before compression, e is the error after, delta_e = e0 − e
 * (higher is better). The commitment is sha256 of the canonical JSON of the
 * other fields. No clock, no env, no Level 4 import.
 */
import { createHash } from "node:crypto";
import type { ScpMeasurement } from "./types";

export interface ScpMeasurementV0120 extends ScpMeasurement {
  metric: number;
  bound: number;
  pass: boolean;
  /** sha256 of the canonical JSON of every field except this one. */
  commitment: string;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src).sort()) {
      if (src[key] !== undefined) out[key] = canonicalize(src[key]);
    }
    return out;
  }
  return value;
}

/** Stable JSON: sorted keys, no undefined. Used for commitments. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function commitScpMeasurement(body: Omit<ScpMeasurementV0120, "commitment">): ScpMeasurementV0120 {
  return { ...body, commitment: sha256Hex(canonicalJson(body)) };
}

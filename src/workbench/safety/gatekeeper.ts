/**
 * Human-in-the-loop bridge for regulated buyers.
 * If Δe does not fall below threshold in N steps, freeze and export a digest.
 */
import type { Gate } from "@/lib/closed-loop";
import type { DiagnosticRecord } from "@/product/diagnostic";

export type Handshake = "HOLD" | "CLINICIAN_REVIEW" | "ESCALATE" | "FROZEN";

export type GatekeeperPolicy = {
  max_iterations: number;
  min_delta_e: number;
  stall_epsilon: number;
};

export const DEFAULT_POLICY: GatekeeperPolicy = {
  max_iterations: 6,
  min_delta_e: 0.15,
  stall_epsilon: 0.01,
};

export type FrozenAudit = {
  run_id: string;
  frozen_at: string;
  reason: string;
  handshake: Handshake;
  gate: Gate;
  e0: number;
  e_now: number;
  delta_e: number;
  iterations: number;
  threshold: number;
  digest_sha256: string;
  history: DiagnosticRecord[];
};

const AUDIT_KEY = "aethel-frozen-audits";

export function shouldFreeze(opts: {
  iterations: number;
  delta_e: number;
  last_reduction: number;
  policy?: GatekeeperPolicy;
}): { freeze: boolean; reason: string } {
  const policy = opts.policy || DEFAULT_POLICY;
  if (opts.iterations >= policy.max_iterations && opts.delta_e < policy.min_delta_e) {
    return {
      freeze: true,
      reason: `Δe=${opts.delta_e} below ${policy.min_delta_e} after ${opts.iterations} steps`,
    };
  }
  if (opts.iterations >= 3 && Math.abs(opts.last_reduction) < policy.stall_epsilon) {
    return {
      freeze: true,
      reason: `loop stalled; last reduction ${opts.last_reduction}`,
    };
  }
  return { freeze: false, reason: "" };
}

export function handshakeOf(gate: Gate, frozen: boolean): Handshake {
  if (frozen) return "FROZEN";
  return gate;
}

export async function digestHistory(history: unknown): Promise<string> {
  const payload = JSON.stringify(history);
  const encoded = new TextEncoder().encode(payload);
  if (globalThis.crypto?.subtle) {
    const buf = await globalThis.crypto.subtle.digest("SHA-256", encoded);
    return [...new Uint8Array(buf)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  let h = 0;
  for (let i = 0; i < payload.length; i++) {
    h = (h * 33 + payload.charCodeAt(i)) >>> 0;
  }
  return `fallback_${h.toString(16)}_${payload.length}`;
}

export async function freezeRun(opts: {
  run_id: string;
  e0: number;
  e_now: number;
  iterations: number;
  gate: Gate;
  history: DiagnosticRecord[];
  reason: string;
  policy?: GatekeeperPolicy;
}): Promise<FrozenAudit> {
  const policy = opts.policy || DEFAULT_POLICY;
  const digest_sha256 = await digestHistory({
    run_id: opts.run_id,
    e0: opts.e0,
    e_now: opts.e_now,
    iterations: opts.iterations,
    history: opts.history,
  });
  const audit: FrozenAudit = {
    run_id: opts.run_id,
    frozen_at: new Date().toISOString(),
    reason: opts.reason,
    handshake: "FROZEN",
    gate: opts.gate,
    e0: opts.e0,
    e_now: opts.e_now,
    delta_e: Number((opts.e0 - opts.e_now).toFixed(3)),
    iterations: opts.iterations,
    threshold: policy.min_delta_e,
    digest_sha256,
    history: opts.history,
  };
  persistAudit(audit);
  return audit;
}

export function persistAudit(audit: FrozenAudit) {
  if (typeof window === "undefined") return;
  const rest = readAudits().filter((a) => a.run_id !== audit.run_id);
  window.localStorage.setItem(AUDIT_KEY, JSON.stringify([audit, ...rest].slice(0, 24)));
}

export function readAudits(): FrozenAudit[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(AUDIT_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as FrozenAudit[];
  } catch {
    return [];
  }
}
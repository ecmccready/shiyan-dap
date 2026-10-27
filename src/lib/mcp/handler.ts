/**
 * Workbench B as an MCP server.
 * Tools and resources only. No Controller A. No Self(). No ledger of prior Runs.
 */
import { W, measureZ, gateOf, type PlantB, type YAction } from "../closed-loop";
import { defaultError, safetySchema } from "../engine";
import {
  AETHEL_CONTRACT,
  MCP_PROTOCOL,
  MCP_RESOURCES,
  MCP_TOOLS,
  RECORDED_PACKS,
  SEALED_SEQUENCE,
  phiOf,
  isErrorWin,
  type LoopObservation,
  type YName,
} from "./schema";
import { holographicDefaultCheck, parseTensorPayload, requestIndependentTensorCheck, sealTensorBinding } from "../level4/seal";
import { validEps, type AdaptiveBase } from "../level4/roe-adaptive";
import { combineEligibility, isNormalizedMode, normalizedRmsCheck, parseTensor, verifyHolographicBound, holographicLedgerTokens, type HolographicBound, type TensorCheck } from "../level4/tensor";

type Rpc = { jsonrpc: "2.0"; id?: number | string | null; method: string; params?: Record<string, unknown> };

const plants = new Map<string, PlantB>();
/** Tensor check from request_independent_check, bound by the next seal_pack. Only set when a tensor was sent. */
const tensorChecks = new Map<string, TensorCheck>();
/** Holographic bound info (default for request_independent_check / seal_pack with a tensor; absent when holographic:false). */
const holoChecks = new Map<string, HolographicBound>();

function holographicOf(tensor: unknown, baseEpsilon: unknown): HolographicBound {
  const t = (tensor || {}) as { out?: unknown; ref?: unknown };
  const out = parseTensor(t.out);
  const ref = parseTensor(t.ref);
  if (!out || !ref) throw new Error("holographic: invalid tensors");
  const base = typeof baseEpsilon === "number" && Number.isFinite(baseEpsilon) && baseEpsilon >= 0 ? baseEpsilon : 0.16;
  return verifyHolographicBound(out, ref, base);
}

function fresh(caseId: string): PlantB {
  return {
    case_id: caseId,
    completeness: 0.42,
    contradiction: 0.18,
    missing: 0.35,
    uncertainty: 0.22,
    independent_check: 0.1,
    useful: 0.4,
    boundary_ready: 0,
  };
}

function plant(caseId = "mcp-pack"): PlantB {
  const hit = plants.get(caseId);
  if (hit) return hit;
  const next = fresh(caseId);
  plants.set(caseId, next);
  return next;
}

function observe(B: PlantB, y: YName, coldFinal?: number): LoopObservation {
  const before = defaultError(B, safetySchema);
  const next = W(B, y as YAction);
  const meas = measureZ(next, y as YAction);
  const eNext = defaultError(next, safetySchema);
  plants.set(B.case_id, next);
  const phi = typeof coldFinal === "number" ? phiOf(coldFinal, eNext) : null;
  return {
    y,
    z: meas.z,
    z_value: meas.z_value,
    e: before,
    e_next: eNext,
    delta_e: Number((before - eNext).toFixed(3)),
    gate: gateOf(next),
    phi,
  };
}

function toolResult(data: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data, isError: false };
}

export function handleMcp(msg: Rpc, ctx?: { adaptive?: AdaptiveBase }): unknown {
  const id = msg.id ?? null;
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

  if (msg.method === "initialize") {
    return ok({
      protocolVersion: MCP_PROTOCOL,
      capabilities: { tools: {}, resources: {} },
      serverInfo: { name: "aethel-workbench-b", version: AETHEL_CONTRACT },
      instructions: "Workbench B. Tools return z and e. Self() is not here. A tie on final e is not a win.",
    });
  }
  if (msg.method === "notifications/initialized" || msg.method === "initialized") return ok({});
  if (msg.method === "ping") return ok({});
  if (msg.method === "tools/list") return ok({ tools: MCP_TOOLS });
  if (msg.method === "resources/list") return ok({ resources: MCP_RESOURCES });

  if (msg.method === "resources/read") {
    const uri = String(msg.params?.uri || "");
    if (uri === "aethel://reference_truth") {
      return ok({
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            uri,
            domain: safetySchema.domain,
            required_fields: safetySchema.required_fields,
            reference_gate: safetySchema.reference_gate,
            rule: "final e is the win. a shorter path is a note. a tie is not a win.",
          }),
        }],
      });
    }
    if (uri === "aethel://diagnostic_cases") {
      return ok({
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            recorded_on: "2026-10-03",
            commit: "cbb3391e",
            packs: RECORDED_PACKS,
            live_plant: "not these numbers. live e comes from tools/call.",
          }),
        }],
      });
    }
    return fail(-32002, "resource not found");
  }

  if (msg.method === "tools/call") {
    const name = String(msg.params?.name || "");
    const args = (msg.params?.arguments || {}) as {
      case_id?: string;
      cold_final_e?: number;
      tensor?: unknown;
      holographic?: boolean;
      baseEpsilon?: number;
      mode?: string;
      eps_base?: number;
      adaptive?: boolean;
      run_id?: string;
    };
    const caseId = args.case_id || "mcp-pack";

    // Tensor scope (optional). Without args.tensor every branch below returns
    // exactly what it returned before; tensor fields are omitted, not null.
    const tensorStep =
      name === "request_independent_check" || name === "seal_pack" || name === "run_sealed_sequence";
    const tensor = tensorStep ? parseTensorPayload(args.tensor) : undefined;
    if (tensor === null) return fail(-32602, "invalid tensor payload: { out, ref, epsilon, metric?, refCommitment? }");
    let check: TensorCheck | undefined;
    if (tensor) {
      try {
        check = requestIndependentTensorCheck(tensor);
      } catch (err) {
        return fail(-32602, err instanceof Error ? err.message : "tensor check failed");
      }
    }
    let holo: HolographicBound | undefined;
    // Default for NEW calls: holographic verdict (ε_dyn = ε_base·√(N/4), Frobenius only).
    // holographic: false gives exactly the old fixed-ε response. run_sealed_sequence stays fixed.
    if (tensor && check && args.holographic !== false && (name === "request_independent_check" || name === "seal_pack")
      && (tensor.metric ?? "frobenius") === "frobenius") {
      try {
        const base = typeof args.baseEpsilon === "number" && Number.isFinite(args.baseEpsilon) && args.baseEpsilon >= 0 ? args.baseEpsilon : 0.16;
        check = holographicDefaultCheck(tensor, base);
        holo = holographicOf(args.tensor, args.baseEpsilon);
      } catch (err) {
        return fail(-32602, err instanceof Error ? err.message : "holographic check failed");
      }
    }
    if (name === "observe") {
      // Read-only: reports the current plant without applying W(), so e_next equals e and delta_e is 0. (The "observe" YAction in
      // closed-loop.ts, which the Level 4 loop may apply, is unchanged and is not used here.)
      const B = plant(caseId);
      const meas = measureZ(B, "observe" as YAction);
      const e = defaultError(B, safetySchema);
      const cold: LoopObservation = { y: "observe", z: meas.z, z_value: meas.z_value, e, e_next: e, delta_e: 0, gate: gateOf(B), phi: null };
      return ok(toolResult(cold));
    }
    if (name === "score_error") {
      const B = plant(caseId);
      return ok(toolResult({ case_id: caseId, e: defaultError(B, safetySchema), gate: gateOf(B) }));
    }
    if (name === "run_sealed_sequence") {
      if (typeof args.cold_final_e !== "number") return fail(-32602, "cold_final_e is required. the server does not read M.");
      plants.set(caseId, fresh(caseId));
      tensorChecks.delete(caseId);
      if (check) {
        // Independent check runs before seal_pack; a violation fails the seal (seal_pack is not applied).
        const binding = sealTensorBinding(check);
        const steps: LoopObservation[] = [];
        for (const y of SEALED_SEQUENCE) {
          if (y === "seal_pack" && !binding.sealed) break;
          steps.push(observe(plant(caseId), y, args.cold_final_e));
        }
        const finalE = steps[steps.length - 1]?.e_next ?? null;
        const phi = typeof finalE === "number" ? phiOf(args.cold_final_e, finalE) : 0;
        return ok(toolResult({
          sequence: SEALED_SEQUENCE,
          outside_self: true,
          steps,
          final_e: finalE,
          phi,
          better: combineEligibility(isErrorWin(phi), check),
          mark_changes_e: false,
          seal_is_the_drop: true,
          sealed: binding.sealed,
          tensor_seal: binding.seal,
        }));
      }
      const steps = SEALED_SEQUENCE.map((y) => observe(plant(caseId), y, args.cold_final_e));
      const finalE = steps[steps.length - 1]?.e_next ?? null;
      const phi = typeof finalE === "number" ? phiOf(args.cold_final_e, finalE) : 0;
      return ok(toolResult({
        sequence: SEALED_SEQUENCE,
        outside_self: true,
        steps,
        final_e: finalE,
        phi,
        better: isErrorWin(phi),
        mark_changes_e: false,
        seal_is_the_drop: true,
      }));
    }
    // A plain re-check (no tensor) drops any tensor check pending from an earlier call.
    if (!check && name === "request_independent_check") {
      tensorChecks.delete(caseId);
      holoChecks.delete(caseId);
    }
    if (check && name === "request_independent_check") {
      tensorChecks.set(caseId, check);
      if (holo) holoChecks.set(caseId, holo);
      else holoChecks.delete(caseId);
      const res0 = { ...observe(plant(caseId), name as YName, args.cold_final_e), tensor_check: check };
      // ROE opt-in: mode "normalized" | "rms" adds the normalized RMS check (informational; verdict unchanged).
      let res: typeof res0 & { normalized?: ReturnType<typeof normalizedRmsCheck> & { eps_source?: string; adaptive?: AdaptiveBase["adaptive"] } } = res0;
      if (tensor && isNormalizedMode(args.mode)) {
        const epsBase = typeof args.eps_base === "number" && Number.isFinite(args.eps_base) && args.eps_base >= 0 ? args.eps_base : tensor.epsilon;
        try {
          if (ctx?.adaptive && args.adaptive === true && !validEps(args.eps_base)) {
            // ROE slice 2: adaptive base (precomputed by the route; read-only). eps_base stays explicit and wins.
            const a = ctx.adaptive;
            res = { ...res0, normalized: { ...normalizedRmsCheck(tensor.out, tensor.ref, a.base), eps_source: a.source, adaptive: a.adaptive } };
          } else if (args.adaptive === true) {
            res = { ...res0, normalized: { ...normalizedRmsCheck(tensor.out, tensor.ref, epsBase), eps_source: validEps(args.eps_base) ? "explicit" : "fallback" } };
          } else {
            res = { ...res0, normalized: normalizedRmsCheck(tensor.out, tensor.ref, epsBase) };
          }
        } catch (err) {
          return fail(-32602, err instanceof Error ? err.message : "normalized check failed");
        }
      }
      return ok(toolResult(holo ? { ...res, holographic: holo, holographic_ledger: holographicLedgerTokens(holo) } : res));
    }
    if (name === "seal_pack" && (check || tensorChecks.has(caseId))) {
      const bound = check ?? (tensorChecks.get(caseId) as TensorCheck);
      // Holographic info: from this call's flag, or carried from the pending check that requested it.
      const h = check ? holo : holoChecks.get(caseId);
      tensorChecks.delete(caseId);
      holoChecks.delete(caseId);
      const binding = sealTensorBinding(bound);
      if (!binding.sealed) {
        // Seal fails: the plant is not transitioned and nothing is eligible.
        const B = plant(caseId);
        const e = defaultError(B, safetySchema);
        return ok({
          ...toolResult({
            y: name, sealed: false, e, e_next: e, delta_e: 0, gate: gateOf(B), eligible: false, tensor_seal: binding.seal,
            ...(h ? { holographic: h, holographic_ledger: holographicLedgerTokens(h) } : {}),
          }),
          isError: true,
        });
      }
      return ok(toolResult({
        ...observe(plant(caseId), name as YName, args.cold_final_e), sealed: true, tensor_seal: binding.seal,
        ...(h ? { holographic: h, holographic_ledger: holographicLedgerTokens(h) } : {}),
      }));
    }
    if (SEALED_SEQUENCE.includes(name as YName) || name === "hold") {
      return ok(toolResult(observe(plant(caseId), name as YName, args.cold_final_e)));
    }
    return fail(-32601, "tool not found");
  }

  return fail(-32601, "method not found");
}

export function resetPlant(caseId = "mcp-pack") {
  plants.set(caseId, fresh(caseId));
  tensorChecks.delete(caseId);
  holoChecks.delete(caseId);
}
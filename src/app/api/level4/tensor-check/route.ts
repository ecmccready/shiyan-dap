import { NextRequest, NextResponse } from "next/server";
import { holographicDefaultCheck, parseTensorPayload, requestIndependentTensorCheck, sealTensorBinding } from "@/lib/level4/seal";
import { adaptiveEpsBase, validEps, wantsAdaptive, type AdaptiveInfo, type EpsSource } from "@/lib/level4/roe-adaptive";
import { MAX_TENSOR_ELEMENTS, verifyHolographicBound, holographicLedgerTokens, isNormalizedMode, normalizedRmsCheck } from "@/lib/level4/tensor";

/**
 * Stateless independent tensor check (tensor scope, additive).
 *
 * POST { out, ref, epsilon, metric?: "frobenius" | "cosine", refCommitment? }
 *   out / ref: { shape: number[], data: number[], dtype?: "f32" | "f64", kind?: string }
 * → { check, sealed, seal }  where seal holds only commitments and the distance.
 *
 * Default (mode omitted or "holographic"): the verdict (check.status, sealed) uses the
 * holographic bound ε_dyn = ε_base·√(N/4) (ε_base = optional body.baseEpsilon, default 0.16;
 * Frobenius only, cosine keeps the caller's ε). check gains bound / max_allowable / fixed_epsilon,
 * and the response adds `holographic: { verified, distance, maxAllowable }` and
 * `holographic_ledger: "H_MAX=… H_DIST=… H_VERIFIED=…"`.
 * mode: "fixed" (body or ?mode=fixed) returns exactly the previous fixed-ε response.
 * A 4-element tensor with ε 0.16 gets the same verdict either way.
 *
 * Reads and writes nothing. Does not touch the experience store or the live run.
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/level4/tensor-check",
    method: "POST",
    body: "{ out, ref, epsilon, metric?: 'frobenius'|'cosine', refCommitment?: 'sha256:<64 hex>' }",
    tensor: "{ shape: number[], data: number[] (row-major), dtype?: 'f32'|'f64', kind?: string }",
    commitment: "sha256 over 'AETHEL-T1;<dtype>;<d1>x…x<dn>;' + little-endian IEEE-754 values",
    max_elements: MAX_TENSOR_ELEMENTS,
    default_bound: "holographic: verdict uses ε_dyn = baseEpsilon·√(N/4) (baseEpsilon? default 0.16; frobenius only). Adds check.bound, check.max_allowable, check.fixed_epsilon, holographic, holographic_ledger",
    fixed_mode: "mode: 'fixed' (body or ?mode=fixed) gives the original fixed-ε response (verdict uses body.epsilon)",
    normalized_mode: "mode: 'normalized' | 'rms' (body or ?mode=) adds normalized: { mode, e_t = ‖T_out−T_ref‖_F/√N, N, eps_base, accepted = e_t ≤ eps_base } (eps_base? default body.epsilon) next to the fixed-ε check. Opt-in; ROE slice 1",
    normalized_eps: "ROE slice 2 (normalized/rms only): baseEpsilon (alias eps_base) or adaptive: true (body or query; optional run_id). Precedence explicit > adaptive > epsilon. Adaptive = last eligible experience entry's tensor_distance (tensor gate not failed), capped at 0.16 (only tightens); no data/store → 0.16. Adds normalized.eps_source and, when adaptive, normalized.adaptive { rule, samples, base }",
    live_demo: "pinned to fixed ε 0.16; does not call this endpoint",
    stores: "nothing",
  });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const payload = parseTensorPayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: "body must be { out, ref, epsilon, metric?, refCommitment? } with valid tensors" },
      { status: 400 }
    );
  }
  try {
    const b = body as Record<string, unknown>;
    const queryMode = req.nextUrl.searchParams.get("mode");
    const mode = b.mode ?? queryMode ?? "holographic";
    if (
      (b.mode !== undefined &&
        b.mode !== "fixed" &&
        b.mode !== "holographic" &&
        !isNormalizedMode(b.mode)) ||
      (queryMode !== null &&
        queryMode !== "fixed" &&
        queryMode !== "holographic" &&
        !isNormalizedMode(queryMode)) ||
      (b.mode !== undefined && queryMode !== null && b.mode !== queryMode)
    ) {
      return NextResponse.json({ error: "Unsupported or conflicting tensor-check mode" }, { status: 400 });
    }
    const numericOptions = ["baseEpsilon", "eps_base"];
    if (
      numericOptions.some(
        (field) =>
          b[field] !== undefined &&
          (typeof b[field] !== "number" || !validEps(b[field]))
      )
    ) {
      return NextResponse.json(
        { error: "baseEpsilon and eps_base must be finite non-negative numbers" },
        { status: 400 }
      );
    }
    const queryEpsilonValues = ["baseEpsilon", "eps_base"]
      .map((field) => req.nextUrl.searchParams.get(field))
      .filter((value): value is string => value !== null);
    if (
      queryEpsilonValues.some((value) => {
        const parsed = Number(value);
        return value.trim() === "" || !validEps(parsed);
      })
    ) {
      return NextResponse.json(
        { error: "Query baseEpsilon and eps_base must be finite non-negative numbers" },
        { status: 400 }
      );
    }
    const adaptiveOption = b.adaptive ?? req.nextUrl.searchParams.get("adaptive");
    if (
      adaptiveOption !== undefined &&
      adaptiveOption !== null &&
      adaptiveOption !== true &&
      adaptiveOption !== false &&
      adaptiveOption !== "true" &&
      adaptiveOption !== "false" &&
      adaptiveOption !== "1" &&
      adaptiveOption !== "0"
    ) {
      return NextResponse.json({ error: "adaptive must be a boolean" }, { status: 400 });
    }
    const runIdOption = b.run_id ?? req.nextUrl.searchParams.get("run_id");
    if (
      runIdOption !== undefined &&
      runIdOption !== null &&
      (typeof runIdOption !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(runIdOption))
    ) {
      return NextResponse.json({ error: "Invalid run_id" }, { status: 400 });
    }
    if (mode === "fixed") {
      const check = requestIndependentTensorCheck(payload);
      const { sealed, seal } = sealTensorBinding(check);
      return NextResponse.json({ check, sealed, seal });
    }
    if (isNormalizedMode(mode)) {
      const q = req.nextUrl.searchParams;
      const qNum = (k: string) => (q.get(k) !== null && q.get(k) !== "" ? Number(q.get(k)) : undefined);
      const explicit = [b.baseEpsilon, b.eps_base, qNum("baseEpsilon"), qNum("eps_base")].find(validEps);
      const adaptiveReq = wantsAdaptive(b.adaptive ?? q.get("adaptive"));
      const check = requestIndependentTensorCheck(payload);
      const { sealed, seal } = sealTensorBinding(check);
      const newParams = adaptiveReq || [b.baseEpsilon, qNum("baseEpsilon"), qNum("eps_base")].some(validEps);
      if (!newParams) {
        // Unchanged slice-1 response (body.eps_base or request epsilon, no eps_source).
        const eps1 = validEps(b.eps_base) ? b.eps_base : payload.epsilon;
        return NextResponse.json({ check, sealed, seal, normalized: normalizedRmsCheck(payload.out, payload.ref, eps1) });
      }
      // ROE slice 2: explicit baseEpsilon > adaptive > request epsilon.
      let eps_base = payload.epsilon;
      let eps_source: EpsSource = "default";
      let adaptive: AdaptiveInfo | undefined;
      if (explicit !== undefined) {
        eps_base = explicit;
        eps_source = "explicit";
      } else {
        const runId = typeof runIdOption === "string" ? runIdOption : null;
        const a = await adaptiveEpsBase(runId);
        eps_base = a.base;
        eps_source = a.source;
        adaptive = a.adaptive;
      }
      const normalized = { ...normalizedRmsCheck(payload.out, payload.ref, eps_base), eps_source, ...(adaptive ? { adaptive } : {}) };
      return NextResponse.json({ check, sealed, seal, normalized });
    }
    const baseEpsilon =
      typeof b.baseEpsilon === "number" && Number.isFinite(b.baseEpsilon) && b.baseEpsilon >= 0
        ? b.baseEpsilon
        : 0.16;
    const check = holographicDefaultCheck(payload, baseEpsilon);
    const { sealed, seal } = sealTensorBinding(check);
    if ((payload.metric ?? "frobenius") !== "frobenius") {
      return NextResponse.json({ check, sealed, seal });
    }
    const holographic = verifyHolographicBound(payload.out, payload.ref, baseEpsilon);
    return NextResponse.json({ check, sealed, seal, holographic, holographic_ledger: holographicLedgerTokens(holographic) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "tensor check failed" },
      { status: 400 }
    );
  }
}

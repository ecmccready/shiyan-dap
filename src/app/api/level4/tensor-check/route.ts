import { NextRequest, NextResponse } from "next/server";
import { holographicDefaultCheck, parseTensorPayload, requestIndependentTensorCheck, sealTensorBinding } from "@/lib/level4/seal";
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
    const mode = b.mode ?? req.nextUrl.searchParams.get("mode");
    if (mode === "fixed") {
      const check = requestIndependentTensorCheck(payload);
      const { sealed, seal } = sealTensorBinding(check);
      return NextResponse.json({ check, sealed, seal });
    }
    if (isNormalizedMode(mode)) {
      const eps_base =
        typeof b.eps_base === "number" && Number.isFinite(b.eps_base) && b.eps_base >= 0 ? b.eps_base : payload.epsilon;
      const check = requestIndependentTensorCheck(payload);
      const { sealed, seal } = sealTensorBinding(check);
      return NextResponse.json({ check, sealed, seal, normalized: normalizedRmsCheck(payload.out, payload.ref, eps_base) });
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

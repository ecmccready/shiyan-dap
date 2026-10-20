import { NextRequest, NextResponse } from "next/server";
import { parseTensorPayload, requestIndependentTensorCheck, sealTensorBinding } from "@/lib/level4/seal";
import { MAX_TENSOR_ELEMENTS, parseTensor, verifyHolographicBound, holographicLedgerTokens } from "@/lib/level4/tensor";

/**
 * Stateless independent tensor check (tensor scope, additive).
 *
 * POST { out, ref, epsilon, metric?: "frobenius" | "cosine", refCommitment? }
 *   out / ref: { shape: number[], data: number[], dtype?: "f32" | "f64", kind?: string }
 * → { check, sealed, seal }  where seal holds only commitments and the distance.
 *
 * Opt-in: mode: "holographic" in the body (or ?mode=holographic) adds
 * `holographic: { verified, distance, maxAllowable }` and `holographic_ledger: "H_MAX=… H_DIST=… H_VERIFIED=…"` with ε_dyn = ε_base·√(N/4)
 * (ε_base = optional body.baseEpsilon, default 0.16). Without it the response is unchanged.
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
    optional_mode: "mode: 'holographic' (body or ?mode=) adds holographic: { verified, distance, maxAllowable }; baseEpsilon? default 0.16",
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
    const check = requestIndependentTensorCheck(payload);
    const { sealed, seal } = sealTensorBinding(check);
    const b = body as Record<string, unknown>;
    const mode = b.mode ?? req.nextUrl.searchParams.get("mode");
    if (mode === "holographic") {
      const out = parseTensor(b.out);
      const ref = parseTensor(b.ref);
      const baseEpsilon =
        typeof b.baseEpsilon === "number" && Number.isFinite(b.baseEpsilon) && b.baseEpsilon >= 0
          ? b.baseEpsilon
          : 0.16;
      if (!out || !ref) throw new Error("holographic: invalid tensors");
      const holographic = verifyHolographicBound(out, ref, baseEpsilon);
      return NextResponse.json({ check, sealed, seal, holographic, holographic_ledger: holographicLedgerTokens(holographic) });
    }
    return NextResponse.json({ check, sealed, seal });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "tensor check failed" },
      { status: 400 }
    );
  }
}

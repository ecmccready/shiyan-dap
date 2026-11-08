import { NextResponse } from "next/server";
import { RUN_CONTRACT_VERSION, submitStandardRun } from "@/core/run-contract";
import { authenticateTenant } from "@/core/tenant-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = authenticateTenant(request);
  if (!auth.ok) return NextResponse.json({ contract_version: RUN_CONTRACT_VERSION, code: auth.code, error: auth.error }, { status: auth.status });
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ contract_version: RUN_CONTRACT_VERSION, code: "INVALID_JSON", error: "Invalid JSON" }, { status: 400 });
  }
  const outcome = submitStandardRun(auth.tenant, body);
  return NextResponse.json(outcome.body, { status: outcome.status });
}

export async function GET() {
  return NextResponse.json({
    contract_version: RUN_CONTRACT_VERSION,
    auth: "Authorization: Bearer <tenant API key>. The tenant is derived on the server from the key; requests without a valid key get 401, and 503 if the server has no tenant keys configured.",
    submit: { method: "POST", route: "/api/v1/runs" },
    verify: { method: "GET", route: "/api/v1/runs/{experience_id}" },
    request_example: {
      contract_version: RUN_CONTRACT_VERSION, run_id: "run-001", workbench: { name: "acme-workbench", version: "0.3.1" },
      goal: "Keep prediction within tolerance", action: "calibrate sensor", predicted: 1, observed: 1, seed: 42, phi: 1, step: 0,
    },
    response: "201 { contract_version, experience_id, experience: ExperienceRecord, verification: VerificationResult, metamorphic: MetamorphicResult, next_action: NextActionProposal }",
    rules: [
      "Unknown fields are rejected, including any caller-supplied verdict, hash, verification or metamorphic result.",
      "The verdict (PASS | FAIL | INCONCLUSIVE) is computed server-side from seed and inputs; the same seed and inputs give the same verdict.",
      "Every run belongs to the authenticated tenant. Another tenant's experience_id returns 404, identical to an unknown id.",
      "experience_id is derived from tenant + workbench.name + run_id. Resubmitting the same run returns 409 DUPLICATE_RUN; records are append-only.",
      "Verify re-reads the stored record, checks its sha256, and recomputes the verdict; a mismatch yields verdict FAIL, a tampered record 422 INTEGRITY_FAILED.",
      "next_action is descriptive only (executable: false). The platform runs no submitted code.",
      "replay_verdict reflects the deterministic metamorphic check, not an independent replay.",
      "Storage is the local experience store; on Vercel it is per-instance /tmp unless AETHEL_HF_MEMORY_ROOT points at durable storage, so a run may not be verifiable on another instance.",
    ],
    errors: { 401: ["UNAUTHENTICATED"], 503: ["AUTH_NOT_CONFIGURED"], 400: ["INVALID_JSON", "INVALID_SUBMISSION", "INVALID_ID"], 404: ["NOT_FOUND"], 409: ["DUPLICATE_RUN", "STORE_BUSY"], 422: ["INTEGRITY_FAILED"], 500: ["STORE_ERROR"] },
  });
}

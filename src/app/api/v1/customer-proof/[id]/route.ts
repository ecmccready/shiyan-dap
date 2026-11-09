import { NextResponse } from "next/server";
import { authenticateTenant } from "../../../../../core/tenant-auth";
import {
  experienceIdFor,
  verifyStandardRun,
} from "../../../../../core/run-contract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Vary: "Authorization",
  "X-Content-Type-Options": "nosniff",
};

const failure = (status: number, code: string) =>
  NextResponse.json({ code }, { status, headers });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = authenticateTenant(request);
  if (!auth.ok) return failure(auth.status, auth.code);

  const { id } = await params;
  if (!/^wb-[0-9a-f]{32}$/.test(id)) {
    return failure(400, "INVALID_ID");
  }

  try {
    const outcome = verifyStandardRun(auth.tenant, id);
    if (!outcome.ok) {
      return failure(outcome.status, outcome.body.code);
    }

    const result = outcome.body;
    const record = result.experience;
    if (
      record.tenant_id !== auth.tenant ||
      record.provenance.source !== "third-party-workbench" ||
      !record.repo.startsWith("workbench:") ||
      experienceIdFor(
        auth.tenant,
        record.repo.slice("workbench:".length),
        record.provenance.run_id,
      ) !== id
    ) {
      return failure(404, "NOT_FOUND");
    }

    if (!/^[0-9a-f]{64}$/.test(result.verification.content_sha256 ?? "")) {
      return failure(422, "INTEGRITY_FAILED");
    }

    if (
      result.verification.integrity !== "PASS" ||
      result.verification.consistent !== true ||
      result.verification.stored_verdict !== result.verification.recomputed_verdict
    ) {
      return failure(422, "VERIFICATION_INCONSISTENT");
    }

    return NextResponse.json(
      {
        report_version: "aethel.customer-proof/1",
        record,
        content_sha256: result.verification.content_sha256,
        server_verdict: result.verification.verdict ?? "INCONCLUSIVE",
      },
      {
        headers: {
          ...headers,
          "Content-Disposition": `attachment; filename="${id}-proof.json"`,
        },
      },
    );
  } catch {
    return failure(503, "REPORT_UNAVAILABLE");
  }
}
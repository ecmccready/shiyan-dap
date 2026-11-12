import { NextResponse } from "next/server";
import {
  connectReference,
  listReferences,
} from "../../../../core/github-reference";
import {
  configuredReferenceStorage,
} from "../../../../core/reference-anchor-provider";
import { authenticateTenant } from "../../../../core/tenant-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = authenticateTenant(request);
  if (!auth.ok) {
    return NextResponse.json(
      { code: auth.code, error: auth.error },
      { status: auth.status },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const storage = configuredReferenceStorage();
  const outcome = await connectReference(
    auth.tenant,
    body,
    process.env,
    undefined,
    storage?.anchors,
    storage?.envelopes,
  );

  return NextResponse.json(outcome.body, {
    status: outcome.status,
  });
}

export async function GET(request: Request) {
  const auth = authenticateTenant(request);
  if (!auth.ok) {
    return NextResponse.json(
      { code: auth.code, error: auth.error },
      { status: auth.status },
    );
  }

  try {
    const storage = configuredReferenceStorage();
    const references = await listReferences(
      auth.tenant,
      storage?.anchors,
      storage?.envelopes,
    );
    return NextResponse.json({ references });
  } catch {
    return NextResponse.json(
      {
        code: "REFERENCE_STORAGE_UNAVAILABLE",
        error: "Reference integrity verification is unavailable",
      },
      { status: 503 },
    );
  }
}
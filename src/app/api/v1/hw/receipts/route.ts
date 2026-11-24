import { NextResponse } from "next/server";
import { acceptHwReceipt, pgReceiptWriter, type HwReceiptWriter } from "../../../../../core/hw-receipt";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Tests pass a writer. The live route uses one that inserts only into shiyan.hw_receipts. */
export async function handleHwReceipt(request: Request, writer: HwReceiptWriter, env: Record<string, string | undefined> = process.env): Promise<Response> {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const signature = request.headers.get("x-hw-receipt-signature") ?? "";
  const result = await acceptHwReceipt(body, signature, env, writer);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ stored: true, table: writer.table, workload_id: result.stored.workload_id });
}

export async function POST(request: Request) {
  const url = process.env.HW_RECEIPT_DATABASE_URL;
  if (!url) {
    return NextResponse.json({ error: "HW_RECEIPT_DATABASE_URL is not set. Migration 007 is unapplied. This route does not write Level 4." }, { status: 503 });
  }
  return handleHwReceipt(request, pgReceiptWriter(url), process.env);
}

export async function GET() {
  return Response.json({
    route: "/api/v1/hw/receipts",
    method: "POST",
    auth: "Ed25519 signature in X-Hw-Receipt-Signature. Public key is HW_RECEIPT_PUBLIC_KEY. The private key stays on the runner.",
    storage: "shiyan.hw_receipts only. Migration 007 is unapplied. No Level 4 write.",
    power: "needs real board",
  });
}

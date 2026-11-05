import { NextResponse } from "next/server";

type DispositionBody = {
  evidenceHash: string;
  disposition: string;
  reviewer?: string;
  notes?: string;
};

// In-memory store for this step (replace with durable store / DB later)
const store = new Map<string, DispositionBody & { createdAt: string }>();

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DispositionBody;
    if (!body.evidenceHash || !body.disposition) {
      return NextResponse.json({ error: "evidenceHash and disposition required" }, { status: 400 });
    }
    const record = {
      ...body,
      createdAt: new Date().toISOString(),
    };
    store.set(body.evidenceHash, record);
    return NextResponse.json({ ok: true, record });
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const hash = searchParams.get("evidenceHash");
  if (!hash) {
    return NextResponse.json({ error: "evidenceHash required" }, { status: 400 });
  }
  const record = store.get(hash);
  if (!record) {
    return NextResponse.json({ found: false });
  }
  return NextResponse.json({ found: true, record });
}
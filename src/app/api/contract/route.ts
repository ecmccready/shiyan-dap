import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();

  const contract = {
    ...body,
    id: `contract_${Date.now()}`,
    agreed_at: new Date().toISOString(),
    status: "agreed",
  };

  return NextResponse.json({ ok: true, contract });
}
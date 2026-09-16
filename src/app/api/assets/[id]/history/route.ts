import { NextResponse } from "next/server";
import { FOUNDER, SLEEP } from "@/lib/ledger";

const TRAIN = [
  "EXECUTE_SETTLEMENT",
  "RETURN",
  "SELF",
  "OBSERVE_AUDIENCE",
];

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const asset = [FOUNDER, SLEEP].find((row) => row.id === id);
  if (!asset) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    protocol: "slice_v6",
    asset: asset.id,
    title: asset.title,
    trade_state: asset.state,
    train: TRAIN,
    note: "Live outcome rows stay on founder-z and the browser Learn ledger. This route names the slice train.",
    evidence: "https://huggingface.co/datasets/shiyan-dap/founder-z",
    head: "https://huggingface.co/datasets/shiyan-dap/founder-z/blob/main/latest-z.json",
  });
}
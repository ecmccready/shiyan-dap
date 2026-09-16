import { NextResponse } from "next/server";
import { FOUNDER, SLEEP, nextState, type TradeEvent } from "@/lib/ledger";
import {
  computeB,
  errorSignal,
  f,
  Self,
  yFromAsset,
  type OutcomeTransition,
  type YVector,
} from "@/lib/outcomes";
import { TOOL_SCHEMAS, type ToolName } from "@/lib/protocol";

export async function GET() {
  return NextResponse.json({
    ok: true,
    protocol: "slice_v6",
    runtime: "shiyan-native",
    langchain: false,
    tools: TOOL_SCHEMAS,
    rule: "evaluate_outcome calls computeB. Models do not name B.",
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const tool = body.tool as ToolName;
  const outcomes = (body.outcomes || []) as OutcomeTransition[];

  if (!tool || !(tool in TOOL_SCHEMAS)) {
    return NextResponse.json({ ok: false, error: "unknown tool" }, { status: 400 });
  }

  if (tool === "evaluate_outcome") {
    const self = Self(outcomes);
    return NextResponse.json({
      ok: true,
      tool,
      self,
      computed_b: computeB(outcomes),
      z: self.z,
    });
  }

  if (tool === "search_assets") {
    const q = String(body.q || "").toLowerCase();
    const assets = [FOUNDER, SLEEP].filter(
      (a) => !q || a.title.toLowerCase().includes(q) || a.id.includes(q)
    );
    return NextResponse.json({ ok: true, tool, assets });
  }

  if (tool === "inspect_asset") {
    const asset = [FOUNDER, SLEEP].find((a) => a.id === body.id);
    if (!asset) {
      return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    }
    const Y = yFromAsset(asset.state);
    return NextResponse.json({
      ok: true,
      tool,
      asset,
      Y,
      y: f(Y),
      e: errorSignal(Y),
      z: Self(outcomes).z,
      B: computeB(outcomes),
    });
  }

  if (tool === "request_asset") {
    const asset = [FOUNDER, SLEEP].find((a) => a.id === body.id);
    if (!asset) {
      return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      tool,
      event: "INITIATE_TRADE",
      from: asset.state,
      to: nextState(asset.state, "INITIATE_TRADE" as TradeEvent),
      note: "Client ledger applies the event. Settlement is not implied.",
    });
  }

  if (tool === "execute_transaction") {
    if (body.settled !== true) {
      return NextResponse.json(
        {
          ok: false,
          tool,
          error: "settlement=1 only when Stripe reports settled",
        },
        { status: 409 }
      );
    }
    return NextResponse.json({
      ok: true,
      tool,
      event: "EXECUTE_SETTLEMENT",
      note: "A is payment settled. Not demand.",
    });
  }

  if (tool === "self_loop") {
    const self = Self(outcomes);
    return NextResponse.json({
      ok: true,
      tool,
      self,
      computed_b: computeB(outcomes),
      action: "SELF",
    });
  }

  if (tool === "observe_audience") {
    if (!body.asset_id) {
      return NextResponse.json({ ok: false, error: "asset_id required" }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      tool,
      action: "OBSERVE_AUDIENCE",
      asset_id: body.asset_id,
      note: "Client Learn page writes the Y bit. This route names the action only.",
      z: Self(outcomes).z,
    });
  }

  if (tool === "record_measurement") {
    const y_after = body.y_after as YVector | undefined;
    if (!body.asset_id || !body.action || !y_after) {
      return NextResponse.json(
        { ok: false, error: "asset_id, action, y_after required" },
        { status: 400 }
      );
    }
    return NextResponse.json({
      ok: true,
      tool,
      accepted: true,
      asset_id: body.asset_id,
      action: body.action,
      y_after,
      z: Self(outcomes).z,
      computed_b: computeB(outcomes),
    });
  }

  if (tool === "register_asset") {
    const title = String(body.title || "").trim();
    if (!title) {
      return NextResponse.json({ ok: false, error: "title required" }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      tool,
      asset: {
        id: "cl_" + Date.now(),
        title,
        domain: body.domain || "music",
        source: body.source || "protocol register",
        state: "unlisted",
      },
      note: "Client ledger persists via writeExtra.",
    });
  }

  return NextResponse.json({ ok: false, error: "unhandled tool" }, { status: 400 });
}
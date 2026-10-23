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

const Y_FIELDS: (keyof YVector)[] = [
  "settlement",
  "acquisition",
  "audience_response",
  "conversion",
  "revenue",
  "retention",
];

function isYVector(value: unknown): value is YVector {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const vector = value as Record<string, unknown>;
  return Y_FIELDS.every((field) => vector[field] === 0 || vector[field] === 1);
}

function isOutcomeTransition(value: unknown): value is OutcomeTransition {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.asset_id === "string" &&
    typeof row.action === "string" &&
    typeof row.agent === "string" &&
    typeof row.simulated === "boolean" &&
    typeof row.transition_class === "string" &&
    ["positive", "negative", "no_movement", "maintained"].includes(row.transition_class) &&
    isYVector(row.y_after)
  );
}

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
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { ok: false, error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }
  const payload = body as Record<string, unknown>;
  const tool = payload.tool;
  if (typeof tool !== "string" || !Object.hasOwn(TOOL_SCHEMAS, tool)) {
    return NextResponse.json({ ok: false, error: "unknown tool" }, { status: 400 });
  }
  const outcomes = payload.outcomes === undefined ? [] : payload.outcomes;
  if (
    !Array.isArray(outcomes) ||
    outcomes.length > 500 ||
    !outcomes.every(isOutcomeTransition)
  ) {
    return NextResponse.json(
      { ok: false, error: "outcomes must be an array of valid outcome records" },
      { status: 400 }
    );
  }
  const selectedTool = tool as ToolName;

  if (selectedTool === "evaluate_outcome") {
    const self = Self(outcomes);
    return NextResponse.json({
      ok: true,
      tool: selectedTool,
      self,
      computed_b: computeB(outcomes),
      z: self.z,
    });
  }

  if (selectedTool === "search_assets") {
    const query = payload.q ?? "";
    if (typeof query !== "string" || query.length > 200) {
      return NextResponse.json({ ok: false, error: "q must be a string up to 200 characters" }, { status: 400 });
    }
    const q = query.toLowerCase();
    const assets = [FOUNDER, SLEEP].filter(
      (a) => !q || a.title.toLowerCase().includes(q) || a.id.includes(q)
    );
    return NextResponse.json({ ok: true, tool: selectedTool, assets });
  }

  if (selectedTool === "inspect_asset") {
    const id = payload.id;
    if (typeof id !== "string") {
      return NextResponse.json({ ok: false, error: "id must be a string" }, { status: 400 });
    }
    const asset = [FOUNDER, SLEEP].find((a) => a.id === id);
    if (!asset) {
      return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    }
    const Y = yFromAsset(asset.state);
    return NextResponse.json({
      ok: true,
      tool: selectedTool,
      asset,
      Y,
      y: f(Y),
      e: errorSignal(Y),
      z: Self(outcomes).z,
      B: computeB(outcomes),
    });
  }

  if (selectedTool === "request_asset") {
    const id = payload.id;
    if (typeof id !== "string") {
      return NextResponse.json({ ok: false, error: "id must be a string" }, { status: 400 });
    }
    const asset = [FOUNDER, SLEEP].find((a) => a.id === id);
    if (!asset) {
      return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      tool: selectedTool,
      event: "INITIATE_TRADE",
      from: asset.state,
      to: nextState(asset.state, "INITIATE_TRADE" as TradeEvent),
      note: "Client ledger applies the event. Settlement is not implied.",
    });
  }

  if (selectedTool === "execute_transaction") {
    if (payload.settled !== true) {
      return NextResponse.json(
        {
          ok: false,
          tool: selectedTool,
          error: "settlement=1 only when Stripe reports settled",
        },
        { status: 409 }
      );
    }
    return NextResponse.json({
      ok: true,
      tool: selectedTool,
      event: "EXECUTE_SETTLEMENT",
      note: "A is payment settled. Not demand.",
    });
  }

  if (selectedTool === "self_loop") {
    const self = Self(outcomes);
    return NextResponse.json({
      ok: true,
      tool: selectedTool,
      self,
      computed_b: computeB(outcomes),
      action: "SELF",
    });
  }

  if (selectedTool === "observe_audience") {
    if (typeof payload.asset_id !== "string" || !payload.asset_id.trim()) {
      return NextResponse.json({ ok: false, error: "asset_id must be a non-empty string" }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      tool: selectedTool,
      action: "OBSERVE_AUDIENCE",
      asset_id: payload.asset_id,
      note: "Client Learn page writes the Y bit. This route names the action only.",
      z: Self(outcomes).z,
    });
  }

  if (selectedTool === "record_measurement") {
    const y_after = payload.y_after;
    if (
      typeof payload.asset_id !== "string" ||
      !payload.asset_id.trim() ||
      typeof payload.action !== "string" ||
      !payload.action.trim() ||
      !isYVector(y_after)
    ) {
      return NextResponse.json(
        { ok: false, error: "asset_id, action, y_after required" },
        { status: 400 }
      );
    }
    return NextResponse.json({
      ok: true,
      tool: selectedTool,
      accepted: true,
      asset_id: payload.asset_id,
      action: payload.action,
      y_after,
      z: Self(outcomes).z,
      computed_b: computeB(outcomes),
    });
  }

  if (selectedTool === "register_asset") {
    const title = payload.title;
    const domain = payload.domain ?? "music";
    const source = payload.source ?? "protocol register";
    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.length > 200 ||
      typeof domain !== "string" ||
      !domain.trim() ||
      domain.length > 100 ||
      typeof source !== "string" ||
      !source.trim() ||
      source.length > 500
    ) {
      return NextResponse.json(
        { ok: false, error: "Valid title, domain, and source are required" },
        { status: 400 }
      );
    }
    return NextResponse.json({
      ok: true,
      tool: selectedTool,
      asset: {
        id: "cl_" + Date.now(),
        title: title.trim(),
        domain: domain.trim(),
        source: source.trim(),
        state: "unlisted",
      },
      note: "Client ledger persists via writeExtra.",
    });
  }

  return NextResponse.json({ ok: false, error: "unhandled tool" }, { status: 400 });
}
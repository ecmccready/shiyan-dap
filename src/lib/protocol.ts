import type { Bit, ComputedB, OutcomeTransition, YVector } from "@/lib/outcomes";
import type { LedgerAsset, TradeEvent, TradeState } from "@/lib/ledger";

export const PROTOCOL_VERSION = "slice_v6";

export type ToolName =
  | "register_asset"
  | "search_assets"
  | "inspect_asset"
  | "request_asset"
  | "execute_transaction"
  | "record_measurement"
  | "evaluate_outcome"
  | "observe_audience"
  | "self_loop";

export type AccessConditions = {
  settlement: "stripe_settled_only";
  level3: false;
};

export type AssetRecord = {
  asset: string;
  title: string;
  domain: string;
  owner: string;
  buyer: string;
  version: string;
  inputs: { source: string };
  trade_state: TradeState;
  Y: YVector;
  y: Bit;
  e: Bit;
  actions: string[];
  measurements: OutcomeTransition[];
  outcomes: OutcomeTransition[];
  transaction_history: TradeEvent[];
  access_conditions: AccessConditions;
  B: ComputedB | null;
  z: string;
};

export const TOOL_SCHEMAS: Record<
  ToolName,
  { description: string; parameters: Record<string, string> }
> = {
  register_asset: {
    description: "Ingest a creative work into the Shiyan ledger. Does not set settlement.",
    parameters: { title: "string", domain: "string", source: "string" },
  },
  search_assets: {
    description: "Search protocol assets by text, domain, or trade state.",
    parameters: { q: "string?", domain: "string?", state: "string?" },
  },
  inspect_asset: {
    description: "Return the full asset record including Y, e, B, z.",
    parameters: { id: "string" },
  },
  request_asset: {
    description: "INITIATE_TRADE. Moves listed → escrow. Does not settle.",
    parameters: { id: "string" },
  },
  execute_transaction: {
    description: "EXECUTE_SETTLEMENT only when payment is already settled.",
    parameters: { id: "string", settled: "boolean" },
  },
  record_measurement: {
    description: "Write a Y transition. Controller, not the model, names z.",
    parameters: { asset_id: "string", action: "string", y_after: "YVector" },
  },
  evaluate_outcome: {
    description: "Call Self() and computeB(). Never invent B.",
    parameters: {},
  },
  observe_audience: {
    description: "Level 2 listen. Flips audience_response only.",
    parameters: { asset_id: "string" },
  },
  self_loop: {
    description: "Close the loop from state. Writes SELF. No new purchase.",
    parameters: {},
  },
};

export function emptyY(): YVector {
  return {
    settlement: 0,
    acquisition: 0,
    audience_response: 0,
    conversion: 0,
    revenue: 0,
    retention: 0,
  };
}

export function toRecord(
  asset: LedgerAsset,
  extras: {
    Y: YVector;
    y: Bit;
    e: Bit;
    measurements: OutcomeTransition[];
    B: ComputedB | null;
    z: string;
    actions?: string[];
    history?: TradeEvent[];
    domain?: string;
  }
): AssetRecord {
  return {
    asset: asset.id,
    title: asset.title,
    domain: extras.domain || "music",
    owner: asset.owner,
    buyer: asset.buyer,
    version: PROTOCOL_VERSION,
    inputs: { source: asset.source },
    trade_state: asset.state,
    Y: extras.Y,
    y: extras.y,
    e: extras.e,
    actions: extras.actions || extras.measurements.map((row) => row.action),
    measurements: extras.measurements,
    outcomes: extras.measurements,
    transaction_history: extras.history || [],
    access_conditions: { settlement: "stripe_settled_only", level3: false },
    B: extras.B,
    z: extras.z,
  };
}
import type { CommercialIds } from "@/lib/correlation";

export type CommercialPhase =
  | "OFFER"
  | "TRANSACTION"
  | "EXTERNAL_EVENT"
  | "MEASUREMENT"
  | "Z";

export type CommercialRow = CommercialIds & {
  assetId: string;
  title: string;
  amountCents: 100;
  provider: "stripe";
  phase: CommercialPhase;
  observed: 0 | 1;
  settlement_written: false;
  level3: false;
  independent: boolean;
  stripeSessionId: string | null;
  pingId: string | null;
  created_at: string;
  observed_at: string | null;
};

const g = globalThis as unknown as { __shiyanCommercial?: Map<string, CommercialRow> };

export function commercialStore() {
  if (!g.__shiyanCommercial) g.__shiyanCommercial = new Map();
  return g.__shiyanCommercial;
}

export function chainOf(row: CommercialRow): CommercialPhase[] {
  if (row.phase === "Z") return ["OFFER", "TRANSACTION", "EXTERNAL_EVENT", "MEASUREMENT", "Z"];
  if (row.phase === "MEASUREMENT") return ["OFFER", "TRANSACTION", "EXTERNAL_EVENT", "MEASUREMENT"];
  if (row.phase === "EXTERNAL_EVENT") return ["OFFER", "TRANSACTION", "EXTERNAL_EVENT"];
  if (row.phase === "TRANSACTION") return ["OFFER", "TRANSACTION"];
  return ["OFFER"];
}
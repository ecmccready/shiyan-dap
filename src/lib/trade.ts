export type TradeState = "offered" | "accepted" | "rejected" | "timeout";

export type TradeRecord = {
  trade_id: string;
  asset_id: string;
  offer: string;
  state: TradeState;
  observed: 0 | 1;
  ping_id: string | null;
  source: "p2p-trade";
  level3: false;
  settlement_written: false;
  created_at: string;
  closed_at: string | null;
};

const KEY = "shiyan-trades-v1";

export function tradeId() {
  return "TRD-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
}

export function readTrades(): TradeRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function writeTrades(rows: TradeRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 40)));
}
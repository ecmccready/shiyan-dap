export type TradeState = "unlisted" | "listed" | "escrow" | "settled" | "cancelled";
export type TradeEvent = "LIST" | "INITIATE_TRADE" | "EXECUTE_SETTLEMENT" | "ABORT";

export type LedgerAsset = {
  id: string;
  title: string;
  creator: string;
  owner: string;
  buyer: string;
  source: string;
  state: TradeState;
  founder?: boolean;
};

export const USER_A = "ECMcCready";
export const USER_B = "This session";

export const FOUNDER: LedgerAsset = {
  id: "cl_shiyan_yishu_001",
  title: "Shiyan Yishu — First Single",
  creator: USER_A,
  owner: USER_A,
  buyer: "None yet",
  source: "founder proof · file optional",
  state: "listed",
  founder: true,
};

export const SLEEP: LedgerAsset = {
  id: "cl_sleep_terrors_001",
  title: "Sleep Terrors — Second Single",
  creator: USER_A,
  owner: USER_A,
  buyer: "None yet",
  source: "second single · GP8 / Cubase later",
  state: "listed",
  founder: true,
};

const KEY = "shiyan-ledger-v2";
const OLD = "shiyan-ledger-v1";
const OFFICIAL = [FOUNDER.id, SLEEP.id];

const ALLOWED: Record<TradeState, Partial<Record<TradeEvent, TradeState>>> = {
  unlisted: { LIST: "listed" },
  listed: { INITIATE_TRADE: "escrow" },
  escrow: { EXECUTE_SETTLEMENT: "settled", ABORT: "cancelled" },
  settled: {},
  cancelled: { LIST: "listed" },
};

export function nextState(state: TradeState, event: TradeEvent): TradeState | null {
  return ALLOWED[state][event] || null;
}

function stateKey(id: string) {
  return "shiyan-state-" + id;
}

function normalize(a: Partial<LedgerAsset> & { id: string; title: string }): LedgerAsset {
  const legacy = (a as { state?: string }).state;
  const state: TradeState =
    legacy === "available" || legacy === "listed" ? "listed" :
    legacy === "reserved" || legacy === "escrow" ? "escrow" :
    legacy === "settled" || legacy === "cancelled" || legacy === "unlisted" ? (legacy as TradeState) :
    "listed";
  return {
    id: a.id,
    title: a.title,
    creator: a.creator || USER_B,
    owner: a.owner || a.creator || USER_B,
    buyer: a.buyer || "None yet",
    source: a.source || "creator project",
    state,
    founder: Boolean(a.founder),
  };
}

function hydrate(base: LedgerAsset): LedgerAsset {
  if (typeof window === "undefined") return base;
  const stored = window.localStorage.getItem(stateKey(base.id)) as TradeState | null;
  if (stored === "settled") return { ...base, buyer: USER_B, owner: USER_B, state: "settled" };
  if (stored === "escrow" || window.localStorage.getItem("shiyan-acquired-" + base.id) === "1") {
    return { ...base, buyer: USER_B, state: "escrow" };
  }
  if (stored === "cancelled") return { ...base, state: "cancelled" };
  return base;
}

export function readLedger(): LedgerAsset[] {
  if (typeof window === "undefined") return [FOUNDER, SLEEP];
  try {
    const raw = window.localStorage.getItem(KEY) || window.localStorage.getItem(OLD);
    const extra: LedgerAsset[] = raw ? JSON.parse(raw).map(normalize) : [];
    const others = extra.filter((a) => !OFFICIAL.includes(a.id) && a.title !== "Untitled project");
    return [hydrate(FOUNDER), hydrate(SLEEP), ...others];
  } catch {
    return [FOUNDER, SLEEP];
  }
}

function persist(assets: LedgerAsset[]) {
  window.localStorage.setItem(KEY, JSON.stringify(assets.filter((a) => !OFFICIAL.includes(a.id))));
}

export function writeExtra(asset: LedgerAsset) {
  if (typeof window === "undefined") return;
  const all = readLedger().filter((a) => !OFFICIAL.includes(a.id) && a.id !== asset.id);
  persist([...all, normalize(asset)]);
}

export function applyEvent(id: string, event: TradeEvent) {
  if (typeof window === "undefined") return null;
  const all = readLedger();
  const current = all.find((a) => a.id === id);
  if (!current) return null;
  const next = nextState(current.state, event);
  if (!next) return current;
  const updated: LedgerAsset = {
    ...current,
    state: next,
    buyer: event === "INITIATE_TRADE" || event === "EXECUTE_SETTLEMENT" ? USER_B : current.buyer,
    owner: event === "EXECUTE_SETTLEMENT" ? USER_B : current.owner,
  };
  if (OFFICIAL.includes(id)) {
    window.localStorage.setItem(stateKey(id), next);
    window.localStorage.setItem("shiyan-acquired-" + id, next === "escrow" || next === "settled" ? "1" : "0");
  }
  persist(all.filter((a) => !OFFICIAL.includes(a.id)).map((a) => (a.id === id ? updated : a)));
  return updated;
}

export function markAcquired(id: string) {
  applyEvent(id, "INITIATE_TRADE");
}

export function wasAcquired(id: string) {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("shiyan-acquired-" + id) === "1";
}
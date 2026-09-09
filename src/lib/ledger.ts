export type LedgerAsset = {
  id: string;
  title: string;
  creator: string;
  source: string;
  buyer: string;
  state: "available" | "reserved";
  founder?: boolean;
};

export const FOUNDER: LedgerAsset = {
  id: "cl_shiyan_yishu_001",
  title: "Shiyan Yishu — First Single",
  creator: "ECMcCready",
  source: "founder proof · file optional",
  buyer: "None yet",
  state: "available",
  founder: true,
};

const KEY = "shiyan-ledger-v1";

export function readLedger(): LedgerAsset[] {
  if (typeof window === "undefined") return [FOUNDER];
  try {
    const raw = window.localStorage.getItem(KEY);
    const extra: LedgerAsset[] = raw ? JSON.parse(raw) : [];
    const others = extra.filter((a) => a.id !== FOUNDER.id);
    return [FOUNDER, ...others];
  } catch {
    return [FOUNDER];
  }
}

export function writeExtra(asset: LedgerAsset) {
  if (typeof window === "undefined") return;
  const all = readLedger().filter((a) => !a.founder && a.id !== asset.id);
  window.localStorage.setItem(KEY, JSON.stringify([...all, asset]));
}

export function markAcquired(id: string) {
  if (typeof window === "undefined") return;
  const extras = readLedger()
    .filter((a) => !a.founder)
    .map((a) => (a.id === id ? { ...a, buyer: "This session", state: "reserved" as const } : a));
  window.localStorage.setItem(KEY, JSON.stringify(extras));
  window.localStorage.setItem("shiyan-acquired-" + id, "1");
}

export function wasAcquired(id: string) {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("shiyan-acquired-" + id) === "1";
}

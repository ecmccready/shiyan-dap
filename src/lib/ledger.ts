// Barrel so existing imports of "@/lib/ledger" resolve.
// Re-export the symbols the three failing files actually use.
// Adjust the source files if the real exports live elsewhere.

export type LedgerAsset = {
  id: string;
  title: string;
  creator?: string;
  owner?: string;
  buyer?: string;
  source?: string;
  state?: string;
  founder?: boolean;
};

export const FOUNDER: LedgerAsset = {
  id: "founder",
  title: "Shiyan Yishu",
  state: "listed",
  founder: true,
};

export const SLEEP: LedgerAsset = {
  id: "sleep",
  title: "Sleep Terrors",
  state: "listed",
  founder: false,
};

export function readLedger(): LedgerAsset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("aethel-ledger");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function writeExtra(asset: LedgerAsset): void {
  if (typeof window === "undefined") return;
  const all = readLedger();
  all.push(asset);
  localStorage.setItem("aethel-ledger", JSON.stringify(all));
}
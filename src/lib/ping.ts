export type PingRecord = {
  ping_id: string;
  action_id: string;
  asset_id: string;
  observed: 0 | 1;
  source: "external";
  created_at: string;
  received_at: string | null;
};

const KEY = "shiyan-pings-v1";

export function pingId() {
  return "PING-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

export function readPings(): PingRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function writePings(rows: PingRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 40)));
}

export function publicPingPath(id: string) {
  return "/api/ping/" + id;
}
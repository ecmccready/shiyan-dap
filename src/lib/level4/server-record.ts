import type { ControllerRecord } from "./controller";

const BASE = "/api/level4/run";

export async function saveServerRecord(id: string, rec: ControllerRecord) {
  await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, rec }),
  });
}

export async function loadServerRecord(id: string): Promise<ControllerRecord | null> {
  const res = await fetch(`${BASE}?id=${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.rec ?? null;
}

export async function clearServerRecord(id: string) {
  await fetch(`${BASE}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}
import { kv } from "@vercel/kv";

export type PersistedRun = {
  id: string;
  workspace_id: string;
  client_id: string;
  input_reference: string;
  workflow_version: string;
  model_version: string;
  y: string;
  z: string;
  e: number;
  e_baseline: number | null;
  phi: number | null;
  safety_passed: boolean;
  provenance: string[];
  created_at: string;
  approved: boolean;
};

const PREFIX = "run:";

export async function saveRun(run: PersistedRun): Promise<void> {
  await kv.set(`${PREFIX}${run.id}`, run);
  await kv.sadd(`client:${run.client_id}:runs`, run.id);
  await kv.sadd(`workspace:${run.workspace_id}:runs`, run.id);
}

export async function loadRun(id: string): Promise<PersistedRun | null> {
  return kv.get<PersistedRun>(`${PREFIX}${id}`);
}

export async function listClientRuns(client_id: string): Promise<PersistedRun[]> {
  const ids = await kv.smembers(`client:${client_id}:runs`);
  if (!ids?.length) return [];
  const runs = await Promise.all(ids.map((id) => loadRun(id)));
  return runs.filter(Boolean) as PersistedRun[];
}

export function exportRunJSON(run: PersistedRun): string {
  return JSON.stringify(run, null, 2);
}
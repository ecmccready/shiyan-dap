import { kv } from "@vercel/kv";
import type { ControllerRecord } from "./controller";

const PREFIX = "level4:controller:";

export async function saveController(rec: ControllerRecord): Promise<void> {
  await kv.set(`${PREFIX}${rec.goal_id}`, rec);
}

export async function loadController(
  goal_id: string
): Promise<ControllerRecord | null> {
  return kv.get<ControllerRecord>(`${PREFIX}${goal_id}`);
}
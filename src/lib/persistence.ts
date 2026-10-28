/**
 * Persistence Adapter
 * Current mode: memory
 * Planned mode: aws
 *
 * This keeps the stack portable.
 * The app never talks to AWS directly from pages.
 */

export type PersistenceMode = "memory" | "aws";

export const persistenceMode: PersistenceMode =
  (process.env.PERSISTENCE_MODE as PersistenceMode) || "memory";

export interface PersistencePlan {
  mode: PersistenceMode;
  target: {
    database: string;
    objectStorage: string;
    region: string;
  };
  stores: string[];
  notes: string[];
}

export function getPersistencePlan(): PersistencePlan {
  return {
    mode: persistenceMode,
    target: {
      database: "AWS DynamoDB or Aurora PostgreSQL",
      objectStorage: "AWS S3",
      region: "us-west-2 (preferred starting region)",
    },
    stores: [
      "verified sequences / marketplace inventory",
      "outcomes / .self() measurements",
    ],
    notes: [
      "Keep local/memory mode as the default during JIT development.",
      "Do not couple pages or API routes directly to AWS SDKs.",
      "Grok Bot, Model Adapter, and GTP remain portable above storage.",
      "Large artifacts will later live in object storage, with metadata in the database.",
    ],
  };
}
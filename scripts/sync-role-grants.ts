/**
 * Canonical least-privilege grant list for the scheduled state-chain sync roles.
 * Derived from an audit (2026-11-17) of scripts/sync-state-chains.ts and everything it calls:
 *   source.ts (readTenantAnchors; TENANT_ROWS_SQL used by store.ts),
 *   store.ts (persistTenantSegments: SELECT experiences, SELECT+INSERT state_segments,
 *             pg_advisory_xact_lock(hashtext(...)) — no grant),
 *   anchor-store.ts (anchorStateChainHead: SELECT+INSERT state_chain_anchors,
 *                    pg_advisory_xact_lock — no grant),
 *   chain-head.ts (STATE_ANCHORS_SQL only; CHAIN_HEADS_SQL is used by export-reader.ts,
 *                  which the sync CLI does not import).
 * Not used by the sync path: export-reader.ts, schema-guard, information_schema, pg_catalog.
 * Sequences: none needed. state_segments and state_chain_anchors have no serial/identity
 * (seq is supplied by the writer). recovery_records has recovery_records_id_seq, but the
 * sync only SELECTs that table for context and never INSERTs, so USAGE is not granted.
 * Triggers: 004's state_segments_link_check SELECTs state_segments as SECURITY INVOKER
 * (already covered by SELECT); EXECUTE is not checked when a trigger fires.
 * reject_mutation() only raises. Catalog reads need no grant.
 * No deviations from docs/design/4d-state-compression.md § "Least privilege".
 */
export const STORAGE_SYNC_ROLE = "shiyan_sync";
export const ANCHOR_SYNC_ROLE = "shiyan_anchor_sync";
export const STORAGE_SCHEMA = "shiyan";
export const ANCHOR_SCHEMA = "shiyan_anchor";

export const DANGEROUS_MEMBERSHIPS: Record<string, readonly string[]> = {
  [STORAGE_SYNC_ROLE]: ["shiyan_app", "neon_superuser"],
  [ANCHOR_SYNC_ROLE]: ["shiyan_anchor", "shiyan_anchor_app", "neon_superuser"],
} as const;

export type TableGrant = { table: string; privileges: readonly ("SELECT" | "INSERT")[] };

export interface RoleGrantSpec {
  role: string;
  project: "storage" | "anchors";
  schema: string;
  tables: readonly TableGrant[];
}

export const SYNC_ROLE_GRANTS: readonly RoleGrantSpec[] = [
  {
    role: STORAGE_SYNC_ROLE,
    project: "storage",
    schema: STORAGE_SCHEMA,
    tables: [
      { table: "shiyan.experiences", privileges: ["SELECT"] },
      { table: "shiyan.state_segments", privileges: ["SELECT", "INSERT"] },
    ],
  },
  {
    role: ANCHOR_SYNC_ROLE,
    project: "anchors",
    schema: ANCHOR_SCHEMA,
    tables: [
      { table: "shiyan_anchor.reference_anchors", privileges: ["SELECT"] },
      { table: "shiyan_anchor.recovery_records", privileges: ["SELECT"] },
      { table: "shiyan_anchor.state_chain_anchors", privileges: ["SELECT", "INSERT"] },
    ],
  },
];

export const FORBIDDEN_TABLE_PRIVILEGES = ["UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"] as const;
export const ALL_TABLE_PRIVILEGES = ["SELECT", "INSERT", ...FORBIDDEN_TABLE_PRIVILEGES] as const;
export const SEQUENCE_PRIVILEGES = ["USAGE", "SELECT", "UPDATE"] as const;

export type TableVerb = "SELECT" | "INSERT";
export interface SqlTableUse { verb: TableVerb; table: string }

/** Qualified table names touched by a SQL string (FROM / JOIN / INSERT INTO). Ignores function-only SELECTs. */
export function tablesUsedInSql(sql: string): SqlTableUse[] {
  const out: SqlTableUse[] = [];
  for (const m of sql.matchAll(/\bINSERT\s+INTO\s+([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)\b/gi)) {
    out.push({ verb: "INSERT", table: m[1].toLowerCase() });
  }
  for (const m of sql.matchAll(/\b(?:FROM|JOIN)\s+([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)\b/gi)) {
    out.push({ verb: "SELECT", table: m[1].toLowerCase() });
  }
  return out;
}

export function privilegesAllowed(spec: RoleGrantSpec, table: string): ReadonlySet<string> {
  const row = spec.tables.find((t) => t.table === table);
  return new Set(row?.privileges ?? []);
}

export function expectedTableNames(spec: RoleGrantSpec): ReadonlySet<string> {
  return new Set(spec.tables.map((t) => t.table));
}

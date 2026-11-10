// Neon Postgres adapters for GitHub reference integrity.
//  - NeonReferenceAnchors: the independent anchor ledger. Lives in a SEPARATE Neon project/database,
//    reached with a separate role that can only SELECT and INSERT (db/migrations/001_shiyan_anchors.sql).
//  - NeonReferenceEnvelopes: envelope bytes in the main storage database (db/migrations/001_shiyan_storage.sql).
// Both are append-only: INSERT ... ON CONFLICT DO NOTHING, then read back the durable winner.
// There is no UPDATE or DELETE anywhere in this file; the database also rejects them with triggers.
import { createHash } from "node:crypto";
import type { Pool } from "pg";
import {
  ReferenceStorageError,
  type IndependentReferenceAnchors, type ReferenceAnchor, type ReferenceEnvelopeStore,
} from "./github-reference";
import { TENANT_ID_PATTERN } from "./tenant-auth";

const REFERENCE_ID = /^ref-[0-9a-f]{32}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const GIT_SHA = /^[0-9a-f]{40}$/;
const MAX_LIST = 10_000;
const MAX_ENVELOPE_BYTES = 32 * 1024 * 1024;

function checkKey(tenant: string, id?: string): void {
  if (!TENANT_ID_PATTERN.test(tenant)) throw new ReferenceStorageError("Invalid tenant");
  if (id !== undefined && !REFERENCE_ID.test(id)) throw new ReferenceStorageError("Invalid reference id");
}
async function guarded<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch (error) {
    if (error instanceof ReferenceStorageError) throw error;
    // Outages and permission errors throw; they are never reported as absence.
    throw new ReferenceStorageError("Reference storage backend unavailable");
  }
}

type AnchorRow = {
  tenant_id: unknown; reference_id: unknown; anchor_version: unknown; envelope_format: unknown;
  repo: unknown; commit_sha: unknown; snapshot_sha256: unknown; envelope_sha256: unknown;
};
const ANCHOR_COLUMNS = "tenant_id, reference_id, anchor_version, envelope_format, repo, commit_sha, snapshot_sha256, envelope_sha256";

function rowToAnchor(row: AnchorRow): ReferenceAnchor {
  const fields = [row.tenant_id, row.reference_id, row.anchor_version, row.envelope_format, row.repo, row.commit_sha, row.snapshot_sha256, row.envelope_sha256];
  if (!fields.every((value) => typeof value === "string")) throw new ReferenceStorageError("Malformed anchor row");
  // Full validation (versions, repo pattern, id derivation) is repeated by checkedAnchor in github-reference.
  return {
    anchor_version: row.anchor_version as ReferenceAnchor["anchor_version"],
    envelope_format: row.envelope_format as ReferenceAnchor["envelope_format"],
    tenant: row.tenant_id as string, reference_id: row.reference_id as string,
    repo: row.repo as string, commit_sha: row.commit_sha as string,
    snapshot_sha256: row.snapshot_sha256 as string, envelope_sha256: row.envelope_sha256 as string,
  };
}

export class NeonReferenceAnchors implements IndependentReferenceAnchors {
  constructor(private readonly pool: Pool) {}

  /** Atomic first-writer-wins on (tenant, reference_id); returns the durable winner. */
  async createIfAbsent(anchor: ReferenceAnchor): Promise<ReferenceAnchor> {
    checkKey(anchor.tenant, anchor.reference_id);
    if (!GIT_SHA.test(anchor.commit_sha) || !SHA256_HEX.test(anchor.snapshot_sha256) || !SHA256_HEX.test(anchor.envelope_sha256)) {
      throw new ReferenceStorageError("Invalid proposed anchor");
    }
    return guarded(async () => {
      await this.pool.query(
        `INSERT INTO shiyan_anchor.reference_anchors (${ANCHOR_COLUMNS})
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (tenant_id, reference_id) DO NOTHING`,
        [anchor.tenant, anchor.reference_id, anchor.anchor_version, anchor.envelope_format,
          anchor.repo, anchor.commit_sha, anchor.snapshot_sha256, anchor.envelope_sha256],
      );
      const winner = await this.get(anchor.tenant, anchor.reference_id);
      if (!winner) throw new ReferenceStorageError("Anchor not durable after insert");
      return winner;
    });
  }

  async get(tenant: string, id: string): Promise<ReferenceAnchor | null> {
    checkKey(tenant, id);
    return guarded(async () => {
      const result = await this.pool.query<AnchorRow>(
        `SELECT ${ANCHOR_COLUMNS} FROM shiyan_anchor.reference_anchors WHERE tenant_id = $1 AND reference_id = $2`,
        [tenant, id],
      );
      if (result.rows.length === 0) return null;
      if (result.rows.length !== 1) throw new ReferenceStorageError("Ambiguous anchor");
      return rowToAnchor(result.rows[0]);
    });
  }

  async listTenant(tenant: string): Promise<readonly ReferenceAnchor[]> {
    checkKey(tenant);
    return guarded(async () => {
      const result = await this.pool.query<AnchorRow>(
        `SELECT ${ANCHOR_COLUMNS} FROM shiyan_anchor.reference_anchors WHERE tenant_id = $1 ORDER BY reference_id LIMIT $2`,
        [tenant, MAX_LIST + 1],
      );
      // A result above MAX_LIST is passed through so the caller fails closed on the limit.
      return result.rows.map(rowToAnchor);
    });
  }
}

type EnvelopeRow = { tenant_id: unknown; reference_id: unknown; envelope: unknown; envelope_sha256: unknown };

export class NeonReferenceEnvelopes implements ReferenceEnvelopeStore {
  constructor(private readonly pool: Pool) {}

  async putIfAbsent(tenant: string, id: string, bytes: Buffer): Promise<{ bytes: Buffer; created: boolean }> {
    checkKey(tenant, id);
    if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > MAX_ENVELOPE_BYTES) throw new ReferenceStorageError("Invalid envelope");
    const hash = createHash("sha256").update(bytes).digest("hex");
    return guarded(async () => {
      const inserted = await this.pool.query(
        `INSERT INTO shiyan.reference_envelopes (tenant_id, reference_id, envelope, envelope_sha256)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tenant_id, reference_id) DO NOTHING
         RETURNING reference_id`,
        [tenant, id, bytes, hash],
      );
      const stored = await this.get(tenant, id);
      if (!stored) throw new ReferenceStorageError("Envelope not durable after insert");
      return { bytes: stored, created: inserted.rowCount === 1 };
    });
  }

  async get(tenant: string, id: string): Promise<Buffer | null> {
    checkKey(tenant, id);
    return guarded(async () => {
      const result = await this.pool.query<EnvelopeRow>(
        "SELECT tenant_id, reference_id, envelope, envelope_sha256 FROM shiyan.reference_envelopes WHERE tenant_id = $1 AND reference_id = $2",
        [tenant, id],
      );
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      if (result.rows.length !== 1 || row.tenant_id !== tenant || row.reference_id !== id || !Buffer.isBuffer(row.envelope)
        || typeof row.envelope_sha256 !== "string" || createHash("sha256").update(row.envelope).digest("hex") !== row.envelope_sha256) {
        throw new ReferenceStorageError("Stored envelope failed its row checksum");
      }
      // The authoritative check is against the independent anchor in readReference.
      return row.envelope;
    });
  }

  async listIds(tenant: string): Promise<readonly string[]> {
    checkKey(tenant);
    return guarded(async () => {
      const result = await this.pool.query<{ reference_id: unknown }>(
        "SELECT reference_id FROM shiyan.reference_envelopes WHERE tenant_id = $1 ORDER BY reference_id LIMIT $2",
        [tenant, MAX_LIST + 1],
      );
      return result.rows.map((row) => {
        if (typeof row.reference_id !== "string") throw new ReferenceStorageError("Malformed envelope listing");
        return row.reference_id;
      });
    });
  }
}

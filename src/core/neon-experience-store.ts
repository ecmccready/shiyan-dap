// Neon Postgres experience store: append-only, tenant-scoped, content-hashed, transactional.
// Schema: db/migrations/001_shiyan_storage.sql. The app role holds only SELECT and INSERT.
import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { experienceDigest } from "./hf-memory";
import { type ExperienceRecord, validateExperienceRecord } from "./experience-schema";
import {
  ExperienceAppendError, ExperienceIntegrityError, ExperienceNotFoundError,
  ExperienceStoreUnavailableError, type ExperienceStoreLike,
} from "./experience-store";
import { inTransaction, isUniqueViolation } from "./neon-db";
import { TENANT_ID_PATTERN } from "./tenant-auth";

const EXPERIENCE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const MAX_RECORD_BYTES = 1024 * 1024;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

type Row = { tenant_id: unknown; experience_id: unknown; record_json: unknown; content_sha256: unknown; proof_timestamp: unknown };
const SELECT_ONE = `SELECT tenant_id, experience_id, record_json, content_sha256, proof_timestamp
  FROM shiyan.experiences WHERE tenant_id = $1 AND experience_id = $2`;

export class NeonExperienceStore implements ExperienceStoreLike {
  constructor(private readonly tenant: string, private readonly pool: Pool) {
    if (!TENANT_ID_PATTERN.test(tenant)) throw new Error("Invalid tenant id");
  }

  async append<T extends ExperienceRecord>(record: T): Promise<T> {
    const id = String(record?.experience_id);
    if (!validateExperienceRecord(record)) throw new ExperienceAppendError(id, "Invalid ExperienceRecord");
    if (record.tenant_id !== this.tenant) throw new ExperienceAppendError(id, "Record tenant does not match the authenticated tenant");
    const json = canonical(record);
    const hash = sha256(json);
    if (hash !== experienceDigest(record)) throw new ExperienceAppendError(id, "Canonical digest mismatch");
    if (Buffer.byteLength(json, "utf8") > MAX_RECORD_BYTES) throw new ExperienceAppendError(id, "Record exceeds 1 MiB");
    const proofTimestamp = new Date().toISOString();
    try {
      await inTransaction(this.pool, async (client) => {
        const inserted = await client.query(
          `INSERT INTO shiyan.experiences (tenant_id, experience_id, record_json, content_sha256, proof_timestamp)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (tenant_id, experience_id) DO NOTHING
           RETURNING experience_id`,
          [this.tenant, id, json, hash, proofTimestamp],
        );
        if (inserted.rowCount !== 1) throw new ExperienceAppendError(id, "Append-only memory refuses existing experience_id");
        const back = await client.query<Row>(SELECT_ONE, [this.tenant, id]);
        const verified = this.verifyRow(id, back.rows);
        if (verified.content_sha256 !== hash) throw new ExperienceAppendError(id, "Write read-back validation failed");
      });
    } catch (error) {
      if (error instanceof ExperienceAppendError) throw error;
      if (error instanceof ExperienceIntegrityError) throw new ExperienceAppendError(id, "Write read-back validation failed");
      if (isUniqueViolation(error)) throw new ExperienceAppendError(id, "Append-only memory refuses existing experience_id");
      throw new ExperienceStoreUnavailableError(id);
    }
    return (await this.readById(id)) as T;
  }

  async readById(id: string): Promise<ExperienceRecord> {
    if (typeof id !== "string" || !EXPERIENCE_ID.test(id)) throw new ExperienceIntegrityError(String(id), "Invalid experience_id");
    let rows: Row[];
    try {
      rows = (await this.pool.query<Row>(SELECT_ONE, [this.tenant, id])).rows;
    } catch (error) {
      throw new ExperienceStoreUnavailableError(id);
    }
    return this.verifyRow(id, rows).record;
  }

  private verifyRow(id: string, rows: Row[]): { record: ExperienceRecord; content_sha256: string } {
    if (rows.length === 0) throw new ExperienceNotFoundError(id);
    if (rows.length !== 1) throw new ExperienceIntegrityError(id, "Ambiguous stored record");
    const row = rows[0];
    if (row.tenant_id !== this.tenant || row.experience_id !== id) throw new ExperienceIntegrityError(id, "Stored identity mismatch");
    if (typeof row.record_json !== "string" || typeof row.content_sha256 !== "string" || !SHA256_HEX.test(row.content_sha256)) {
      throw new ExperienceIntegrityError(id, "Stored record is malformed");
    }
    if (!(row.proof_timestamp instanceof Date) || !Number.isFinite(row.proof_timestamp.getTime())) {
      throw new ExperienceIntegrityError(id, "Stored proof timestamp is malformed");
    }
    if (sha256(row.record_json) !== row.content_sha256) throw new ExperienceIntegrityError(id, "Stored bytes do not match content_sha256");
    let parsed: unknown;
    try { parsed = JSON.parse(row.record_json); } catch { throw new ExperienceIntegrityError(id, "Stored record is not JSON"); }
    if (!validateExperienceRecord(parsed) || parsed.experience_id !== id) throw new ExperienceIntegrityError(id, "Experience read-back schema validation failed");
    if (parsed.tenant_id !== this.tenant) throw new ExperienceIntegrityError(id, "Stored record tenant mismatch");
    if (experienceDigest(parsed) !== row.content_sha256) throw new ExperienceIntegrityError(id, "Experience proof validation failed");
    return { record: parsed, content_sha256: row.content_sha256 };
  }
}

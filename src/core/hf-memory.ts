// Node-only local dataset adapter. No network calls or Hugging Face credentials.
import { createHash, randomUUID } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ExperienceRecord as CanonicalExperienceRecord } from "./interfaces";
import { type ExperienceRecord, validateExperienceRecord } from "./experience-schema";

export type MemoryResult<T> = { ok: true; value: T } | { ok: false; error: string };
export const DEFAULT_MEMORY_ROOT = resolve(".aethel/hf-memory");

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
/** sha256 of the canonical record; equals the stored proof hash for any record that passed readExperience. */
export const experienceDigest = (record: ExperienceRecord) => createHash("sha256").update(canonical(record)).digest("hex");
const digest = experienceDigest;
const failure = (error: unknown): { ok: false; error: string } => ({
  ok: false, error: error instanceof Error ? error.message : String(error),
});
function safeId(id: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/.test(id)) throw new Error("Invalid experience_id");
}

/**
 * Immutable records/proofs use exclusive creation; latest.json is the sole mutable pointer.
 * Failed writes can leave immutable orphan files for inspection, never a success result.
 * A writer lock serializes pointer updates; a stale lock fails closed (no automatic deletion).
 * readText is injectable solely to exercise storage read-back failures in offline checks.
 */
export class HFMemory {
  private readonly base: string;
  constructor(root = process.env.AETHEL_HF_MEMORY_ROOT || DEFAULT_MEMORY_ROOT, private readonly readText = (path: string) => readFileSync(path, "utf8")) {
    this.base = join(resolve(root), "founder-z");
  }

  readExperience(id: string): MemoryResult<ExperienceRecord> {
    try {
      safeId(id);
      const record: unknown = JSON.parse(this.readText(join(this.base, "experiences", `${id}.json`)));
      if (!validateExperienceRecord(record) || record.experience_id !== id) throw new Error("Experience read-back schema validation failed");
      const proof = JSON.parse(this.readText(join(this.base, "proofs", `${id}.json`)));
      if (proof?.experience_id !== id || proof?.sha256 !== digest(record)
        || typeof proof?.timestamp !== "string" || !Number.isFinite(Date.parse(proof.timestamp))) {
        throw new Error("Experience proof validation failed");
      }
      return { ok: true, value: record };
    } catch (error) { return failure(error); }
  }

  listExperiences(): MemoryResult<ExperienceRecord[]> {
    try {
      const dir = join(this.base, "experiences");
      if (!existsSync(dir)) return { ok: true, value: [] };
      const records: ExperienceRecord[] = [];
      for (const name of readdirSync(dir).filter((name) => name.endsWith(".json")).sort()) {
        const result = this.readExperience(name.slice(0, -5));
        // Fail closed rather than silently recommending from an incomplete/corrupt dataset.
        if (!result.ok) return result;
        records.push(result.value);
      }
      return { ok: true, value: records };
    } catch (error) { return failure(error); }
  }

  /** Verified, eligible records newest first. Legacy records have no proven convergence. */
  retrieveEligible(): MemoryResult<CanonicalExperienceRecord[]> {
    const records = this.listExperiences();
    if (!records.ok) return records;
    return { ok: true, value: records.value
      .filter((record) => record.reuse_eligibility === true)
      .map((record) => ({ ...record, metamorphic: {
        ...record.metamorphic, converged: record.metamorphic.converged === true,
      } }))
      .sort((a, b) => Date.parse(b.provenance.timestamp) - Date.parse(a.provenance.timestamp)
        || a.experience_id.localeCompare(b.experience_id)) };
  }

  writeExperience<T extends ExperienceRecord>(record: T): MemoryResult<T> {
    try { return { ok: true, value: this.append(record) as T }; }
    catch (error) { return failure(error); }
  }

  private append(record: ExperienceRecord): ExperienceRecord {
    let lock: number | undefined;
    let temp: string | undefined;
    const lockPath = join(this.base, "indexes", ".writer.lock");
    try {
      if (!validateExperienceRecord(record)) throw new Error("Invalid ExperienceRecord");
      for (const dir of ["experiences", "proofs", "indexes"]) mkdirSync(join(this.base, dir), { recursive: true });
      lock = openSync(lockPath, "wx");
      const recordPath = join(this.base, "experiences", `${record.experience_id}.json`);
      const proofPath = join(this.base, "proofs", `${record.experience_id}.json`);
      // Preflight both paths; wx remains the final guard against replacing any immutable file.
      if (existsSync(recordPath) || existsSync(proofPath)) throw new Error("Append-only memory refuses existing experience_id");
      writeFileSync(recordPath, JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
      const readBack: unknown = JSON.parse(this.readText(recordPath));
      if (!validateExperienceRecord(readBack) || digest(readBack) !== digest(record)) throw new Error("Experience write read-back validation failed");
      const timestamp = new Date().toISOString();
      const proof = { experience_id: record.experience_id, sha256: digest(record), timestamp };
      writeFileSync(proofPath, JSON.stringify(proof, null, 2) + "\n", { flag: "wx" });
      const verified = this.readExperience(record.experience_id);
      if (!verified.ok) throw new Error(verified.error);
      const index = { ...proof, experience_path: `founder-z/experiences/${record.experience_id}.json`,
        proof_path: `founder-z/proofs/${record.experience_id}.json` };
      const indexText = JSON.stringify(index, null, 2) + "\n";
      temp = join(this.base, "indexes", `.latest-${randomUUID()}.tmp`);
      writeFileSync(temp, indexText, { flag: "wx" });
      if (canonical(JSON.parse(this.readText(temp))) !== canonical(index)) throw new Error("Index write read-back validation failed");
      // Publish only after record, proof, and staged index have passed read-back validation.
      const latest = join(this.base, "indexes", "latest.json");
      renameSync(temp, latest);
      temp = undefined;
      if (canonical(JSON.parse(this.readText(latest))) !== canonical(index)) throw new Error("Latest index read-back validation failed");
      return verified.value;
    } finally {
      if (temp && existsSync(temp)) unlinkSync(temp);
      if (lock !== undefined) { closeSync(lock); unlinkSync(lockPath); }
    }
  }
}

/** Canonical v1.1 API; errors throw rather than masquerading as empty memory. */
export function writeExperience(record: CanonicalExperienceRecord, memory = new HFMemory()): CanonicalExperienceRecord {
  if (typeof record.metamorphic?.converged !== "boolean") throw new Error("Canonical record requires converged");
  const saved = memory.writeExperience(record);
  if (!saved.ok) throw new Error(saved.error);
  return saved.value;
}

export function retrieveEligible(memory = new HFMemory()): CanonicalExperienceRecord[] {
  const eligible = memory.retrieveEligible();
  if (!eligible.ok) throw new Error(eligible.error);
  return eligible.value;
}

// Production persistence for experience records: append-only, local-file backed, integrity-checked.
// Backed by the existing Hugging Face-shaped local dataset (HFMemory). No cloud storage.
import { HFMemory, DEFAULT_MEMORY_ROOT } from "./hf-memory";
import type { ExperienceRecord } from "./experience-schema";

export class ExperienceIntegrityError extends Error {
  constructor(readonly experienceId: string, detail: string) {
    super(`Experience integrity check failed for ${experienceId}: ${detail}`);
    this.name = "ExperienceIntegrityError";
  }
}
export class ExperienceAppendError extends Error {
  constructor(readonly experienceId: string, detail: string) {
    super(`Experience append rejected for ${experienceId}: ${detail}`);
    this.name = "ExperienceAppendError";
  }
}

/**
 * Store root: AETHEL_HF_MEMORY_ROOT if set; on Vercel, /tmp (writable but ephemeral per instance);
 * otherwise the repo-local .aethel/hf-memory directory, which survives process restarts.
 */
export function resolveExperienceStoreRoot(env: Record<string, string | undefined> = process.env): string {
  return env.AETHEL_HF_MEMORY_ROOT || (env.VERCEL ? "/tmp/aethel-hf-memory" : DEFAULT_MEMORY_ROOT);
}

/** True only when records live on a filesystem expected to outlast the process and instance. */
export function isDurableExperienceStore(env: Record<string, string | undefined> = process.env): boolean {
  return !(env.VERCEL && !env.AETHEL_HF_MEMORY_ROOT) && !resolveExperienceStoreRoot(env).startsWith("/tmp");
}

export class ExperienceStore {
  constructor(private readonly memory = new HFMemory(resolveExperienceStoreRoot())) {}

  /** Append a new record. The sha256 of its canonical form is stored in a separate proof file. */
  append<T extends ExperienceRecord>(record: T): T {
    const saved = this.memory.writeExperience(record);
    if (!saved.ok) throw new ExperienceAppendError(String(record?.experience_id), saved.error);
    return saved.value;
  }

  /** Read by id, recomputing the content hash; throws ExperienceIntegrityError on any mismatch. */
  readById(id: string): ExperienceRecord {
    const result = this.memory.readExperience(id);
    if (!result.ok) throw new ExperienceIntegrityError(id, result.error);
    return result.value;
  }

  /** All records, each integrity-checked; fails closed if any record is corrupt. */
  list(): ExperienceRecord[] {
    const result = this.memory.listExperiences();
    if (!result.ok) throw new ExperienceIntegrityError("*", result.error);
    return result.value;
  }
}

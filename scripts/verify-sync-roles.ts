/**
 * Live verifier for the scheduled-sync least-privilege roles. Connects with the SYNC role URLs,
 * runs only BEGIN READ ONLY plus has_*_privilege / pg_catalog probes, writes nothing, and prints
 * only the role name plus PASS/FAIL per expected and forbidden privilege. Never prints URLs.
 *
 *   npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/verify-sync-roles.ts \
 *     --storage-file ~/.shiyan-storage-sync-url --anchor-file ~/.shiyan-anchor-sync-url
 *
 * Exit codes: 0 PASS, 1 any FAIL or a connection failed, 2 usage.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { independentDatabases } from "../src/core/neon-db";
import { diagnosticErrorClass, diagnosticErrorCode } from "../src/core/storage-diagnostics";
import { argValue, defaultDeps, readUrl, type CompressTenantDeps, type CompressTenantOutcome } from "./compress-tenant";
import {
  ALL_TABLE_PRIVILEGES, DANGEROUS_MEMBERSHIPS, FORBIDDEN_TABLE_PRIVILEGES,
  SEQUENCE_PRIVILEGES, SYNC_ROLE_GRANTS, expectedTableNames, privilegesAllowed,
  type RoleGrantSpec,
} from "./sync-role-grants";
import type { ReadOnlyClient } from "../src/core/compression/source";

type Env = Record<string, string | undefined>;

export const VERIFY_BEGIN = "BEGIN READ ONLY";
export const VERIFY_ROLE_SQL = "SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname = current_user";
export const VERIFY_MEMBERS_SQL = "SELECT r.rolname FROM pg_auth_members m JOIN pg_roles mem ON mem.oid = m.member JOIN pg_roles r ON r.oid = m.roleid WHERE mem.rolname = current_user ORDER BY r.rolname";
export const VERIFY_SCHEMA_SQL = "SELECT has_schema_privilege(current_user, $1, 'USAGE') AS usage, has_schema_privilege(current_user, $1, 'CREATE') AS create_schema";
export const VERIFY_TABLES_SQL = "SELECT n.nspname AS schema, c.relname AS name"
  + ", has_table_privilege(current_user, quote_ident(n.nspname) || '.' || quote_ident(c.relname), 'SELECT') AS sel"
  + ", has_table_privilege(current_user, quote_ident(n.nspname) || '.' || quote_ident(c.relname), 'INSERT') AS ins"
  + ", has_table_privilege(current_user, quote_ident(n.nspname) || '.' || quote_ident(c.relname), 'UPDATE') AS upd"
  + ", has_table_privilege(current_user, quote_ident(n.nspname) || '.' || quote_ident(c.relname), 'DELETE') AS del"
  + ", has_table_privilege(current_user, quote_ident(n.nspname) || '.' || quote_ident(c.relname), 'TRUNCATE') AS trunc"
  + ", has_table_privilege(current_user, quote_ident(n.nspname) || '.' || quote_ident(c.relname), 'REFERENCES') AS refs"
  + ", has_table_privilege(current_user, quote_ident(n.nspname) || '.' || quote_ident(c.relname), 'TRIGGER') AS trig"
  + " FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace"
  + " WHERE n.nspname = $1 AND c.relkind IN ('r', 'p', 'v', 'm') ORDER BY 1, 2";
export const VERIFY_SEQUENCES_SQL = "SELECT n.nspname AS schema, c.relname AS name"
  + ", has_sequence_privilege(current_user, quote_ident(n.nspname) || '.' || quote_ident(c.relname), 'USAGE') AS usage"
  + ", has_sequence_privilege(current_user, quote_ident(n.nspname) || '.' || quote_ident(c.relname), 'SELECT') AS sel"
  + ", has_sequence_privilege(current_user, quote_ident(n.nspname) || '.' || quote_ident(c.relname), 'UPDATE') AS upd"
  + " FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace"
  + " WHERE n.nspname = $1 AND c.relkind = 'S' ORDER BY 1, 2";

const ALLOWED_SQL: readonly string[] = [
  VERIFY_BEGIN, VERIFY_ROLE_SQL, VERIFY_MEMBERS_SQL, VERIFY_SCHEMA_SQL, VERIFY_TABLES_SQL, VERIFY_SEQUENCES_SQL,
  "COMMIT", "ROLLBACK",
];

export function isAllowedVerifySql(sql: string): boolean {
  return ALLOWED_SQL.includes(sql);
}

const dbDetail = (error: unknown) => `class=${diagnosticErrorClass(error) || "unknown"} code=${diagnosticErrorCode(error) || "none"}`;
const truthy = (v: unknown) => v === true || v === "t" || v === "true" || v === "1" || v === 1;

export interface RoleFlags {
  rolname: string;
  rolsuper: boolean;
  rolcreatedb: boolean;
  rolcreaterole: boolean;
  rolreplication: boolean;
  rolbypassrls: boolean;
  rolcanlogin: boolean;
}

export interface TablePrivRow {
  schema: string;
  name: string;
  sel: boolean;
  ins: boolean;
  upd: boolean;
  del: boolean;
  trunc: boolean;
  refs: boolean;
  trig: boolean;
}

export interface SequencePrivRow {
  schema: string;
  name: string;
  usage: boolean;
  sel: boolean;
  upd: boolean;
}

export interface RoleObservation {
  role: RoleFlags;
  members: string[];
  schemaUsage: boolean;
  schemaCreate: boolean;
  tables: TablePrivRow[];
  sequences: SequencePrivRow[];
}

export interface PrivilegeJudgement {
  ok: boolean;
  lines: string[];
}

/** Pure: turn one role's observed privileges into PASS/FAIL lines. */
export function judgeRolePrivileges(spec: RoleGrantSpec, obs: RoleObservation): PrivilegeJudgement {
  const lines: string[] = [];
  const pass = (msg: string) => lines.push(`  PASS ${msg}`);
  const fail = (msg: string) => { lines.push(`  FAIL ${msg}`); ok = false; };
  let ok = true;

  if (obs.role.rolname !== spec.role) fail(`connected as ${obs.role.rolname}, expected ${spec.role}`);
  else pass(`role=${spec.role}`);

  const flags: [keyof RoleFlags, string][] = [
    ["rolsuper", "SUPERUSER"], ["rolcreatedb", "CREATEDB"], ["rolcreaterole", "CREATEROLE"],
    ["rolreplication", "REPLICATION"], ["rolbypassrls", "BYPASSRLS"],
  ];
  const badFlags = flags.filter(([k]) => obs.role[k] === true).map(([, n]) => n);
  if (badFlags.length) fail(`role has ${badFlags.join(", ")}`);
  else pass("role is not SUPERUSER/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS");
  if (!obs.role.rolcanlogin) fail("role cannot log in");
  else pass("role can log in");

  const dangerous = new Set(DANGEROUS_MEMBERSHIPS[spec.role] ?? []);
  const badMembers = obs.members.filter((m) => dangerous.has(m));
  if (badMembers.length) fail(`member of ${badMembers.join(", ")}`);
  else pass(`not a member of ${(DANGEROUS_MEMBERSHIPS[spec.role] ?? []).join(" / ") || "dangerous roles"}`);

  if (!obs.schemaUsage) fail(`schema ${spec.schema} USAGE`);
  else pass(`schema ${spec.schema} USAGE`);
  if (obs.schemaCreate) fail(`schema ${spec.schema} has CREATE`);
  else pass(`schema ${spec.schema} no CREATE`);

  const expected = expectedTableNames(spec);
  const seen = new Set<string>();
  for (const t of obs.tables) {
    const q = `${t.schema}.${t.name}`;
    seen.add(q);
    const allowed = privilegesAllowed(spec, q);
    const held: Record<(typeof ALL_TABLE_PRIVILEGES)[number], boolean> = {
      SELECT: t.sel, INSERT: t.ins, UPDATE: t.upd, DELETE: t.del, TRUNCATE: t.trunc, REFERENCES: t.refs, TRIGGER: t.trig,
    };
    for (const p of ALL_TABLE_PRIVILEGES) {
      const has = held[p];
      const want = allowed.has(p);
      if (want && has) pass(`table ${q} ${p}`);
      else if (want && !has) fail(`table ${q} missing ${p}`);
      else if (!want && has) fail(`table ${q} has ${p}`);
      else if (expected.has(q) && (FORBIDDEN_TABLE_PRIVILEGES as readonly string[]).includes(p)) pass(`table ${q} no ${p}`);
      // unexpected tables: only report the privileges they actually have (already FAILed above) and
      // a clean "no access" when they have none.
    }
    if (!expected.has(q) && !ALL_TABLE_PRIVILEGES.some((p) => held[p])) pass(`table ${q} no access`);
  }
  for (const q of expected) if (!seen.has(q)) fail(`table ${q} is missing from the catalog`);

  for (const s of obs.sequences) {
    const q = `${s.schema}.${s.name}`;
    const held = { USAGE: s.usage, SELECT: s.sel, UPDATE: s.upd };
    const any = SEQUENCE_PRIVILEGES.some((p) => held[p]);
    if (any) {
      for (const p of SEQUENCE_PRIVILEGES) if (held[p]) fail(`sequence ${q} has ${p}`);
    } else pass(`sequence ${q} no access`);
  }

  return { ok, lines };
}

function rowRole(raw: unknown): RoleFlags {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    rolname: typeof r.rolname === "string" ? r.rolname : "",
    rolsuper: truthy(r.rolsuper), rolcreatedb: truthy(r.rolcreatedb), rolcreaterole: truthy(r.rolcreaterole),
    rolreplication: truthy(r.rolreplication), rolbypassrls: truthy(r.rolbypassrls), rolcanlogin: truthy(r.rolcanlogin),
  };
}

function rowTable(raw: unknown): TablePrivRow {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    schema: String(r.schema ?? ""), name: String(r.name ?? ""),
    sel: truthy(r.sel), ins: truthy(r.ins), upd: truthy(r.upd), del: truthy(r.del),
    trunc: truthy(r.trunc), refs: truthy(r.refs), trig: truthy(r.trig),
  };
}

function rowSeq(raw: unknown): SequencePrivRow {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    schema: String(r.schema ?? ""), name: String(r.name ?? ""),
    usage: truthy(r.usage), sel: truthy(r.sel), upd: truthy(r.upd),
  };
}

async function observe(client: ReadOnlyClient, spec: RoleGrantSpec): Promise<RoleObservation> {
  const send = (sql: string, params?: unknown[]) => {
    if (!isAllowedVerifySql(sql)) throw new Error("statement is not on the verify-sync-roles allowlist");
    return params === undefined ? client.query(sql) : client.query(sql, params);
  };
  await send(VERIFY_BEGIN);
  try {
    const roleRows = (await send(VERIFY_ROLE_SQL))?.rows ?? [];
    const memberRows = (await send(VERIFY_MEMBERS_SQL))?.rows ?? [];
    const schemaRows = (await send(VERIFY_SCHEMA_SQL, [spec.schema]))?.rows ?? [];
    const tableRows = (await send(VERIFY_TABLES_SQL, [spec.schema]))?.rows ?? [];
    const seqRows = (await send(VERIFY_SEQUENCES_SQL, [spec.schema]))?.rows ?? [];
    await send("COMMIT");
    const schema = (schemaRows[0] ?? {}) as Record<string, unknown>;
    return {
      role: rowRole(roleRows[0]),
      members: memberRows.map((x) => String((x as Record<string, unknown>).rolname ?? "")).filter(Boolean),
      schemaUsage: truthy(schema.usage),
      schemaCreate: truthy(schema.create_schema),
      tables: tableRows.map(rowTable),
      sequences: seqRows.map(rowSeq),
    };
  } catch (error) {
    try { await send("ROLLBACK"); } catch { /* original error matters */ }
    throw error;
  }
}

async function verifyOne(
  label: string, spec: RoleGrantSpec, client: ReadOnlyClient,
): Promise<{ ok: boolean; lines: string[] }> {
  const lines = [`verify-sync-roles: ${label} role=${spec.role}`];
  try {
    const judged = judgeRolePrivileges(spec, await observe(client, spec));
    return { ok: judged.ok, lines: [...lines, ...judged.lines] };
  } catch (error) {
    return { ok: false, lines: [...lines, `  FAIL ${label}.read: ${dbDetail(error)}`] };
  }
}

export async function runVerifySyncRoles(argv: readonly string[], env: Env, deps: CompressTenantDeps = defaultDeps): Promise<CompressTenantOutcome> {
  const known = new Set(["--storage-file", "--anchor-file"]);
  for (const [i, a] of argv.entries()) {
    if (a.startsWith("--") && !known.has(a)) return { exitCode: 2, lines: [`usage: unknown flag ${a.slice(0, 40)}`] };
    if (!a.startsWith("--") && !(i > 0 && known.has(argv[i - 1] ?? ""))) return { exitCode: 2, lines: ["usage: unexpected argument"] };
  }
  for (const f of ["--storage-file", "--anchor-file"]) {
    if (argv.includes(f) && !argValue(argv, f)) return { exitCode: 2, lines: [`usage: ${f} needs a path`] };
  }
  const storageFile = argValue(argv, "--storage-file");
  const anchorFile = argValue(argv, "--anchor-file");
  if (!storageFile && !env.SHIYAN_STORAGE_URL?.trim()) return { exitCode: 2, lines: ["usage: verify-sync-roles.ts --storage-file <path> --anchor-file <path>"] };
  if (!anchorFile && !env.SHIYAN_ANCHOR_URL?.trim()) return { exitCode: 2, lines: ["usage: provide --anchor-file <path> or SHIYAN_ANCHOR_URL (the independent anchors database)"] };

  const storageUrl = readUrl("storage", storageFile, env.SHIYAN_STORAGE_URL, env, deps);
  if (!storageUrl.ok) return { exitCode: storageUrl.exitCode, lines: [storageUrl.line] };
  const anchorsUrl = readUrl("anchors", anchorFile, env.SHIYAN_ANCHOR_URL, env, deps);
  if (!anchorsUrl.ok) return { exitCode: anchorsUrl.exitCode, lines: [anchorsUrl.line] };
  if (!independentDatabases(storageUrl.checked, anchorsUrl.checked)) {
    return { exitCode: 1, lines: ["FAIL anchors.url: must point at a different database with a different role than storage (nothing was written)"] };
  }

  const storageSpec = SYNC_ROLE_GRANTS.find((s) => s.project === "storage")!;
  const anchorsSpec = SYNC_ROLE_GRANTS.find((s) => s.project === "anchors")!;
  let storage: Awaited<ReturnType<CompressTenantDeps["connect"]>> | undefined;
  let anchors: Awaited<ReturnType<CompressTenantDeps["connect"]>> | undefined;
  const lines: string[] = [];
  try {
    try { storage = await deps.connect(storageUrl.checked, "storage"); }
    catch (error) { return { exitCode: 1, lines: [`FAIL storage.connect: ${dbDetail(error)}`, "RESULT: FAIL (nothing was written)"] }; }
    try { anchors = await deps.connect(anchorsUrl.checked, "anchors"); }
    catch (error) { return { exitCode: 1, lines: [`FAIL anchors.connect: ${dbDetail(error)}`, "RESULT: FAIL (nothing was written)"] }; }
    const a = await verifyOne("storage", storageSpec, storage.client);
    const b = await verifyOne("anchors", anchorsSpec, anchors.client);
    lines.push(...a.lines, ...b.lines);
    const ok = a.ok && b.ok;
    lines.push(ok ? "RESULT: PASS" : "RESULT: FAIL (nothing was written)");
    return { exitCode: ok ? 0 : 1, lines };
  } finally {
    await storage?.close().catch(() => undefined);
    await anchors?.close().catch(() => undefined);
  }
}
const isMain = (() => {
  try { return !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; }
})();

if (isMain) {
  runVerifySyncRoles(process.argv.slice(2), process.env).then(
    ({ exitCode, lines }) => { for (const l of lines) console.log(l); process.exitCode = exitCode; },
    (error) => { console.error(`FAIL verify-sync-roles: class=${diagnosticErrorClass(error) || "unknown"}`); process.exitCode = 1; },
  );
}

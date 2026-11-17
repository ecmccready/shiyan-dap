-- Shiyan DAP: least-privilege role for the scheduled state-chain sync, STORAGE Neon project
-- (shiyan-storage, the same project as shiyan.experiences and shiyan.state_segments).
-- This file does not create the role and does not contain a password.
--
-- Apply as the database owner, e.g. neondb_owner, in the Neon SQL Editor of the
-- shiyan-storage project, AFTER creating a non-admin role named shiyan_sync in the
-- Neon Console (Roles) so Neon generates the password. Do not create it as an admin
-- (it must not be a member of neon_superuser or shiyan_app).
--   Neon SQL Editor: paste this file and run it, or
--   psql "$SHIYAN_STORAGE_OWNER_URL" -v ON_ERROR_STOP=1 -f db/migrations/006_shiyan_sync_role.sql
-- Plain SQL only: no psql \gset / \if. Safe to paste into the Neon SQL Editor.
--
-- What it does:
--   * Fails with a clear exception if role shiyan_sync does not exist, if schema shiyan
--     or the required tables are missing, or if the role is SUPERUSER / CREATEDB /
--     CREATEROLE / REPLICATION / BYPASSRLS or a member of shiyan_app or neon_superuser.
--   * REVOKE ALL on schema shiyan and on all of its tables, sequences and functions
--     from shiyan_sync (idempotent strip of any earlier grants).
--   * GRANT only what the sync path needs (audit of scripts/sync-state-chains.ts and
--     the modules it calls: source.ts TENANT_ROWS_SQL and store.ts; not export-reader.ts):
--       USAGE on schema shiyan
--       SELECT on shiyan.experiences
--       SELECT, INSERT on shiyan.state_segments
--   * No UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER, no CREATE on schema, no grants on
--     reference_envelopes or other tables, no sequence grants (neither experiences nor
--     state_segments uses serial/identity; seq is supplied by the writer).
--   * Append-only triggers on state_segments (migration 004) remain in force; they
--     already block UPDATE/DELETE/TRUNCATE regardless of role.
--
-- Idempotent: safe to re-run. Contains no data and no secrets. Not applied
-- automatically; the owner must run it. Does not alter tables or other roles.

BEGIN;

DO $shiyan_sync_role$
DECLARE
  r pg_roles%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shiyan_sync') THEN
    RAISE EXCEPTION 'role shiyan_sync does not exist; create it as a non-admin role in the Neon Console of the storage project, then re-run this migration'
      USING ERRCODE = 'undefined_object';
  END IF;

  SELECT * INTO STRICT r FROM pg_roles WHERE rolname = 'shiyan_sync';
  IF r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls THEN
    RAISE EXCEPTION 'role shiyan_sync must not be SUPERUSER, CREATEDB, CREATEROLE, REPLICATION or BYPASSRLS; drop it and recreate it as a non-admin Neon role'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT r.rolcanlogin THEN
    RAISE EXCEPTION 'role shiyan_sync must be able to log in'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM pg_auth_members m
      JOIN pg_roles mem ON mem.oid = m.member
      JOIN pg_roles rol ON rol.oid = m.roleid
     WHERE mem.rolname = 'shiyan_sync'
       AND rol.rolname IN ('shiyan_app', 'neon_superuser')
  ) THEN
    RAISE EXCEPTION 'role shiyan_sync must not be a member of shiyan_app or neon_superuser; drop it and recreate it as a non-admin Neon role'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'shiyan') THEN
    RAISE EXCEPTION 'schema shiyan does not exist; apply db/migrations/001_shiyan_storage.sql first'
      USING ERRCODE = 'undefined_object';
  END IF;
  IF to_regclass('shiyan.experiences') IS NULL THEN
    RAISE EXCEPTION 'table shiyan.experiences does not exist; apply db/migrations/001_shiyan_storage.sql first'
      USING ERRCODE = 'undefined_object';
  END IF;
  IF to_regclass('shiyan.state_segments') IS NULL THEN
    RAISE EXCEPTION 'table shiyan.state_segments does not exist; apply db/migrations/004_shiyan_state_segments.sql first'
      USING ERRCODE = 'undefined_object';
  END IF;
END
$shiyan_sync_role$;

REVOKE ALL ON SCHEMA shiyan FROM shiyan_sync;
REVOKE ALL ON ALL TABLES IN SCHEMA shiyan FROM shiyan_sync;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA shiyan FROM shiyan_sync;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA shiyan FROM shiyan_sync;

GRANT USAGE ON SCHEMA shiyan TO shiyan_sync;
GRANT SELECT ON shiyan.experiences TO shiyan_sync;
GRANT SELECT, INSERT ON shiyan.state_segments TO shiyan_sync;

COMMIT;

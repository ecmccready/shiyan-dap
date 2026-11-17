-- Shiyan DAP: least-privilege role for the scheduled state-chain sync, ANCHORS Neon project
-- (the same independent project as 001_shiyan_anchors.sql / 002 / 005, e.g. shiyan-anchors).
-- NOT the storage project. This file does not create the role and does not contain a password.
--
-- Apply as the database owner, e.g. neondb_owner, in the Neon SQL Editor of the
-- anchors project, AFTER creating a non-admin role named shiyan_anchor_sync in the
-- Neon Console (Roles) so Neon generates the password. Do not create it as an admin
-- (it must not be a member of neon_superuser, shiyan_anchor or shiyan_anchor_app).
--   Neon SQL Editor: paste this file and run it, or
--   psql "$SHIYAN_ANCHOR_OWNER_URL" -v ON_ERROR_STOP=1 -f db/migrations/006_shiyan_anchor_sync_role.sql
-- Plain SQL only: no psql \gset / \if. Safe to paste into the Neon SQL Editor.
--
-- What it does:
--   * Fails with a clear exception if role shiyan_anchor_sync does not exist, if schema
--     shiyan_anchor or the required tables are missing, or if the role is SUPERUSER /
--     CREATEDB / CREATEROLE / REPLICATION / BYPASSRLS or a member of shiyan_anchor,
--     shiyan_anchor_app or neon_superuser.
--   * REVOKE ALL on schema shiyan_anchor and on all of its tables, sequences and functions
--     from shiyan_anchor_sync (idempotent strip of any earlier grants).
--   * GRANT only what the sync path needs (audit of scripts/sync-state-chains.ts and
--     the modules it calls: source.ts readTenantAnchors and anchor-store.ts;
--     not export-reader.ts):
--       USAGE on schema shiyan_anchor
--       SELECT on shiyan_anchor.reference_anchors
--       SELECT on shiyan_anchor.recovery_records
--       SELECT, INSERT on shiyan_anchor.state_chain_anchors
--   * No UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER, no CREATE on schema, no sequence
--     grants: state_chain_anchors has no serial/identity (seq is supplied by the writer).
--     recovery_records has recovery_records_id_seq, but the sync only SELECTs that table
--     (context) and never INSERTs, so USAGE on the sequence is not granted.
--   * Append-only triggers on all three tables (001 / 002 / 005) remain in force; they
--     already block UPDATE/DELETE/TRUNCATE regardless of role.
--
-- Idempotent: safe to re-run. Contains no data and no secrets. Not applied
-- automatically; the owner must run it. Does not alter tables or other roles.

BEGIN;

DO $shiyan_anchor_sync_role$
DECLARE
  r pg_roles%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shiyan_anchor_sync') THEN
    RAISE EXCEPTION 'role shiyan_anchor_sync does not exist; create it as a non-admin role in the Neon Console of the anchors project, then re-run this migration'
      USING ERRCODE = 'undefined_object';
  END IF;

  SELECT * INTO STRICT r FROM pg_roles WHERE rolname = 'shiyan_anchor_sync';
  IF r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls THEN
    RAISE EXCEPTION 'role shiyan_anchor_sync must not be SUPERUSER, CREATEDB, CREATEROLE, REPLICATION or BYPASSRLS; drop it and recreate it as a non-admin Neon role'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT r.rolcanlogin THEN
    RAISE EXCEPTION 'role shiyan_anchor_sync must be able to log in'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM pg_auth_members m
      JOIN pg_roles mem ON mem.oid = m.member
      JOIN pg_roles rol ON rol.oid = m.roleid
     WHERE mem.rolname = 'shiyan_anchor_sync'
       AND rol.rolname IN ('shiyan_anchor', 'shiyan_anchor_app', 'neon_superuser')
  ) THEN
    RAISE EXCEPTION 'role shiyan_anchor_sync must not be a member of shiyan_anchor, shiyan_anchor_app or neon_superuser; drop it and recreate it as a non-admin Neon role'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'shiyan_anchor') THEN
    RAISE EXCEPTION 'schema shiyan_anchor does not exist; apply db/migrations/001_shiyan_anchors.sql first'
      USING ERRCODE = 'undefined_object';
  END IF;
  IF to_regclass('shiyan_anchor.reference_anchors') IS NULL THEN
    RAISE EXCEPTION 'table shiyan_anchor.reference_anchors does not exist; apply db/migrations/001_shiyan_anchors.sql first'
      USING ERRCODE = 'undefined_object';
  END IF;
  IF to_regclass('shiyan_anchor.recovery_records') IS NULL THEN
    RAISE EXCEPTION 'table shiyan_anchor.recovery_records does not exist; apply db/migrations/002_shiyan_recovery_records.sql first'
      USING ERRCODE = 'undefined_object';
  END IF;
  IF to_regclass('shiyan_anchor.state_chain_anchors') IS NULL THEN
    RAISE EXCEPTION 'table shiyan_anchor.state_chain_anchors does not exist; apply db/migrations/005_shiyan_state_chain_anchors.sql first'
      USING ERRCODE = 'undefined_object';
  END IF;
END
$shiyan_anchor_sync_role$;

REVOKE ALL ON SCHEMA shiyan_anchor FROM shiyan_anchor_sync;
REVOKE ALL ON ALL TABLES IN SCHEMA shiyan_anchor FROM shiyan_anchor_sync;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA shiyan_anchor FROM shiyan_anchor_sync;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA shiyan_anchor FROM shiyan_anchor_sync;

GRANT USAGE ON SCHEMA shiyan_anchor TO shiyan_anchor_sync;
GRANT SELECT ON shiyan_anchor.reference_anchors TO shiyan_anchor_sync;
GRANT SELECT ON shiyan_anchor.recovery_records TO shiyan_anchor_sync;
GRANT SELECT, INSERT ON shiyan_anchor.state_chain_anchors TO shiyan_anchor_sync;

COMMIT;

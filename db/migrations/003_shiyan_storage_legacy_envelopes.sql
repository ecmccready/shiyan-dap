-- Shiyan DAP: repair a legacy shiyan.reference_envelopes shape in the STORAGE
-- Neon project (the same project as 001_shiyan_storage.sql).
-- Apply as the database owner, e.g. neondb_owner, in the Neon SQL Editor.
--   psql "$SHIYAN_STORAGE_OWNER_URL" -v ON_ERROR_STOP=1 -f db/migrations/003_shiyan_storage_legacy_envelopes.sql
-- Plain SQL only: no psql \gset / \if. Safe to paste into the Neon SQL Editor.
--
-- Why: 001 used CREATE TABLE IF NOT EXISTS. If a table named
-- shiyan.reference_envelopes already existed with a different, older layout
-- (no envelope bytea column), 001 left it in place. The app then failed with
-- REFERENCE_STORAGE_UNAVAILABLE on envelope queries.
--
-- What it does:
--   * If shiyan.reference_envelopes exists, lacks column envelope (legacy
--     shape), and shiyan.reference_envelopes_legacy does not exist, rename the
--     existing table to reference_envelopes_legacy and revoke shiyan_app on it.
--   * Then CREATE TABLE IF NOT EXISTS the correct envelopes table (same DDL
--     as 001), install append-only triggers, REVOKE PUBLIC, and GRANT
--     SELECT, INSERT to shiyan_app when that role exists.
--
-- Idempotent. A no-op in the current production state (correct table already
-- present, legacy table already renamed). Never drops data. Does not alter
-- shiyan.experiences or any other table. Contains no secrets. This file is
-- not applied automatically; the owner must run it.

BEGIN;

CREATE SCHEMA IF NOT EXISTS shiyan;

DO $rename_legacy_envelopes$
BEGIN
  IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'shiyan'
        AND table_name = 'reference_envelopes'
        AND table_type = 'BASE TABLE'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'shiyan'
        AND table_name = 'reference_envelopes'
        AND column_name = 'envelope'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'shiyan'
        AND table_name = 'reference_envelopes_legacy'
        AND table_type = 'BASE TABLE'
    )
  THEN
    ALTER TABLE shiyan.reference_envelopes RENAME TO reference_envelopes_legacy;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shiyan_app') THEN
      REVOKE ALL ON shiyan.reference_envelopes_legacy FROM shiyan_app;
    END IF;
  END IF;
END
$rename_legacy_envelopes$;

CREATE TABLE IF NOT EXISTS shiyan.reference_envelopes (
  tenant_id        text        NOT NULL CHECK (tenant_id ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  reference_id     text        NOT NULL CHECK (reference_id ~ '^ref-[0-9a-f]{32}$'),
  envelope         bytea       NOT NULL CHECK (octet_length(envelope) BETWEEN 1 AND 33554432),
  envelope_sha256  text        NOT NULL CHECK (envelope_sha256 ~ '^[0-9a-f]{64}$'),
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, reference_id),
  CONSTRAINT envelopes_sha256_matches CHECK (envelope_sha256 = encode(sha256(envelope), 'hex'))
);

CREATE OR REPLACE FUNCTION shiyan.reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append-only table %.%: % is not permitted', TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END
$$;

CREATE OR REPLACE TRIGGER envelopes_no_update_delete
  BEFORE UPDATE OR DELETE ON shiyan.reference_envelopes
  FOR EACH ROW EXECUTE FUNCTION shiyan.reject_mutation();

CREATE OR REPLACE TRIGGER envelopes_no_truncate
  BEFORE TRUNCATE ON shiyan.reference_envelopes
  FOR EACH STATEMENT EXECUTE FUNCTION shiyan.reject_mutation();

REVOKE ALL ON shiyan.reference_envelopes FROM PUBLIC;

DO $grant_shiyan_app_envelopes$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shiyan_app') THEN
    GRANT USAGE ON SCHEMA shiyan TO shiyan_app;
    GRANT SELECT, INSERT ON shiyan.reference_envelopes TO shiyan_app;
  END IF;
END
$grant_shiyan_app_envelopes$;

COMMIT;

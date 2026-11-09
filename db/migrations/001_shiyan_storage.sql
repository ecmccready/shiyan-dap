-- Shiyan DAP main storage (Neon project: shiyan-storage). Apply as the database owner, e.g. neondb_owner:
--   psql "$SHIYAN_STORAGE_OWNER_URL" -v ON_ERROR_STOP=1 -v app_password="$SHIYAN_APP_PASSWORD" -f db/migrations/001_shiyan_storage.sql
-- Creates role shiyan_app (LOGIN, SELECT + INSERT only) if it does not exist. The password is supplied
-- through the psql variable app_password and is never stored in this file.
-- Roles created with SQL are NOT members of neon_superuser (unlike roles created in the Neon Console).
-- Idempotent: safe to re-run. Contains no data.

\set ON_ERROR_STOP on
BEGIN;

CREATE SCHEMA IF NOT EXISTS shiyan;

CREATE TABLE IF NOT EXISTS shiyan.experiences (
  tenant_id        text        NOT NULL CHECK (tenant_id ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  experience_id    text        NOT NULL CHECK (experience_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$'),
  record_json      text        NOT NULL CHECK (octet_length(record_json) <= 1048576),
  content_sha256   text        NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  proof_timestamp  timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, experience_id),
  CONSTRAINT experiences_sha256_matches CHECK (content_sha256 = encode(sha256(convert_to(record_json, 'UTF8')), 'hex')),
  CONSTRAINT experiences_tenant_matches CHECK ((record_json::jsonb ->> 'tenant_id') = tenant_id),
  CONSTRAINT experiences_id_matches CHECK ((record_json::jsonb ->> 'experience_id') = experience_id)
);

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

CREATE OR REPLACE TRIGGER experiences_no_update_delete
  BEFORE UPDATE OR DELETE ON shiyan.experiences FOR EACH ROW EXECUTE FUNCTION shiyan.reject_mutation();
CREATE OR REPLACE TRIGGER experiences_no_truncate
  BEFORE TRUNCATE ON shiyan.experiences FOR EACH STATEMENT EXECUTE FUNCTION shiyan.reject_mutation();
CREATE OR REPLACE TRIGGER envelopes_no_update_delete
  BEFORE UPDATE OR DELETE ON shiyan.reference_envelopes FOR EACH ROW EXECUTE FUNCTION shiyan.reject_mutation();
CREATE OR REPLACE TRIGGER envelopes_no_truncate
  BEFORE TRUNCATE ON shiyan.reference_envelopes FOR EACH STATEMENT EXECUTE FUNCTION shiyan.reject_mutation();

COMMIT;

SELECT NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shiyan_app') AS shiyan_need_app_role \gset
\if :shiyan_need_app_role
  CREATE ROLE shiyan_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD :'app_password';
\endif

BEGIN;
REVOKE ALL ON SCHEMA shiyan FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA shiyan FROM PUBLIC;
REVOKE ALL ON FUNCTION shiyan.reject_mutation() FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA shiyan FROM shiyan_app;
GRANT USAGE ON SCHEMA shiyan TO shiyan_app;
GRANT SELECT, INSERT ON shiyan.experiences, shiyan.reference_envelopes TO shiyan_app;
ALTER ROLE shiyan_app SET statement_timeout = '10s';
ALTER ROLE shiyan_app SET search_path = shiyan;
COMMIT;

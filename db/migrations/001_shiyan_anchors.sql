-- Shiyan DAP independent reference anchors. Apply to a SEPARATE Neon project (e.g. shiyan-anchors),
-- administered separately from the storage project, as that project's owner:
--   psql "$SHIYAN_ANCHOR_OWNER_URL" -v ON_ERROR_STOP=1 -v anchor_password="$SHIYAN_ANCHOR_APP_PASSWORD" -f db/migrations/001_shiyan_anchors.sql
-- Creates role shiyan_anchor_app (LOGIN, SELECT + INSERT only). The storage role shiyan_app has no
-- access here. The password comes from the psql variable anchor_password, never from this file.
-- Idempotent: safe to re-run. Contains no data.

\set ON_ERROR_STOP on
BEGIN;

CREATE SCHEMA IF NOT EXISTS shiyan_anchor;

CREATE TABLE IF NOT EXISTS shiyan_anchor.reference_anchors (
  tenant_id        text        NOT NULL CHECK (tenant_id ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  reference_id     text        NOT NULL CHECK (reference_id ~ '^ref-[0-9a-f]{32}$'),
  anchor_version   text        NOT NULL CHECK (anchor_version = 'aethel.reference-anchor/1'),
  envelope_format  text        NOT NULL CHECK (envelope_format = 'aethel.reference-envelope/1'),
  repo             text        NOT NULL CHECK (repo ~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9._-]{1,100}$'),
  commit_sha       text        NOT NULL CHECK (commit_sha ~ '^[0-9a-f]{40}$'),
  snapshot_sha256  text        NOT NULL CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  envelope_sha256  text        NOT NULL CHECK (envelope_sha256 ~ '^[0-9a-f]{64}$'),
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, reference_id)
);

CREATE OR REPLACE FUNCTION shiyan_anchor.reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append-only table %.%: % is not permitted', TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END
$$;

CREATE OR REPLACE TRIGGER anchors_no_update_delete
  BEFORE UPDATE OR DELETE ON shiyan_anchor.reference_anchors FOR EACH ROW EXECUTE FUNCTION shiyan_anchor.reject_mutation();
CREATE OR REPLACE TRIGGER anchors_no_truncate
  BEFORE TRUNCATE ON shiyan_anchor.reference_anchors FOR EACH STATEMENT EXECUTE FUNCTION shiyan_anchor.reject_mutation();

COMMIT;

SELECT NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shiyan_anchor_app') AS shiyan_need_anchor_role \gset
\if :shiyan_need_anchor_role
  CREATE ROLE shiyan_anchor_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD :'anchor_password';
\endif

BEGIN;
REVOKE ALL ON SCHEMA shiyan_anchor FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA shiyan_anchor FROM PUBLIC;
REVOKE ALL ON FUNCTION shiyan_anchor.reject_mutation() FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA shiyan_anchor FROM shiyan_anchor_app;
GRANT USAGE ON SCHEMA shiyan_anchor TO shiyan_anchor_app;
GRANT SELECT, INSERT ON shiyan_anchor.reference_anchors TO shiyan_anchor_app;
ALTER ROLE shiyan_anchor_app SET statement_timeout = '10s';
ALTER ROLE shiyan_anchor_app SET search_path = shiyan_anchor;
COMMIT;

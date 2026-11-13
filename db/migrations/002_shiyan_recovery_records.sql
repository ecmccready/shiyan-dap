-- Shiyan DAP append-only autonomous recovery records.
-- Apply to the SAME independent anchors Neon project as 001_shiyan_anchors.sql, as that
-- project's owner, after 001 has been applied. Plain SQL: safe to paste into the Neon SQL Editor.
--   psql "$SHIYAN_ANCHOR_OWNER_URL" -v ON_ERROR_STOP=1 -f db/migrations/002_shiyan_recovery_records.sql
-- Additive only: creates shiyan_anchor.recovery_records and its triggers/grants. Does not alter or
-- drop existing tables, functions, roles, or the reference_anchors ledger. Reuses
-- shiyan_anchor.reject_mutation() from 001. Idempotent: safe to re-run. Contains no data and no secrets.
-- This file is not applied automatically; the owner must run it.

BEGIN;

CREATE TABLE IF NOT EXISTS shiyan_anchor.recovery_records (
  id                      bigserial    PRIMARY KEY,
  tenant_id               text         NOT NULL CHECK (tenant_id ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  reference_id            text         CHECK (reference_id IS NULL OR reference_id ~ '^ref-[0-9a-f]{32}$'),
  run_id                  text         CHECK (run_id IS NULL OR (char_length(run_id) BETWEEN 1 AND 200)),
  status                  text         NOT NULL CHECK (status IN ('PROMOTED', 'DRIFT_EXCEEDED', 'REJECTED')),
  prior_predicted         double precision NOT NULL,
  synthesized_predicted   double precision,
  anchor_delta            double precision,
  phi_lift                double precision,
  max_anchor_shift_ratio  numeric      NOT NULL CHECK (max_anchor_shift_ratio > 0),
  proof_verdict           text,
  record_sha256           text         NOT NULL CHECK (record_sha256 ~ '^[0-9a-f]{64}$'),
  prev_record_sha256      text         CHECK (prev_record_sha256 IS NULL OR prev_record_sha256 ~ '^[0-9a-f]{64}$'),
  created_at              timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS recovery_records_record_sha256_uidx
  ON shiyan_anchor.recovery_records (record_sha256);

CREATE INDEX IF NOT EXISTS recovery_records_tenant_id_id_idx
  ON shiyan_anchor.recovery_records (tenant_id, id DESC);

-- Append-only: reuse the 001 trigger function (must already exist in this schema).
CREATE OR REPLACE TRIGGER recovery_records_no_update_delete
  BEFORE UPDATE OR DELETE ON shiyan_anchor.recovery_records
  FOR EACH ROW EXECUTE FUNCTION shiyan_anchor.reject_mutation();

CREATE OR REPLACE TRIGGER recovery_records_no_truncate
  BEFORE TRUNCATE ON shiyan_anchor.recovery_records
  FOR EACH STATEMENT EXECUTE FUNCTION shiyan_anchor.reject_mutation();

COMMIT;

-- App role in production is shiyan_anchor. 001 also defines shiyan_anchor_app.
-- Grant only when the role exists so this script is runnable in the SQL Editor
-- without psql conditionals and without creating roles.
DO $grant_shiyan_anchor$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shiyan_anchor') THEN
    GRANT USAGE ON SCHEMA shiyan_anchor TO shiyan_anchor;
    GRANT SELECT, INSERT ON shiyan_anchor.recovery_records TO shiyan_anchor;
    GRANT USAGE, SELECT ON SEQUENCE shiyan_anchor.recovery_records_id_seq TO shiyan_anchor;
  END IF;
END
$grant_shiyan_anchor$;

DO $grant_shiyan_anchor_app$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shiyan_anchor_app') THEN
    GRANT USAGE ON SCHEMA shiyan_anchor TO shiyan_anchor_app;
    GRANT SELECT, INSERT ON shiyan_anchor.recovery_records TO shiyan_anchor_app;
    GRANT USAGE, SELECT ON SEQUENCE shiyan_anchor.recovery_records_id_seq TO shiyan_anchor_app;
  END IF;
END
$grant_shiyan_anchor_app$;

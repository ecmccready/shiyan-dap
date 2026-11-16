-- Shiyan DAP: 4D state compression M4. Append-only per-tenant segment chain in the STORAGE Neon project
-- (shiyan-storage, the same project and schema as shiyan.experiences, whose rows the segments are derived from).
-- Apply as the database owner, e.g. neondb_owner, in the Neon SQL Editor of the shiyan-storage project, or:
--   psql "$SHIYAN_STORAGE_OWNER_URL" -v ON_ERROR_STOP=1 -f db/migrations/004_shiyan_state_segments.sql
-- Plain SQL only: no psql \gset / \if. Safe to paste into the Neon SQL Editor.
--
-- What it does:
--   * CREATE TABLE IF NOT EXISTS shiyan.state_segments: one row per sealed segment, PK (tenant_id, seq).
--     segment_json is the exact canonical() text that segment_sha256 hashes (text, not jsonb, so the bytes
--     are preserved), checked in SQL like experiences.record_json.
--   * BEFORE INSERT row trigger state_segments_link_check: seq 0 has no prev; seq n > 0 requires the
--     tenant's row n-1 to exist with segment_sha256 = prev_segment_sha256. With the PK this makes each
--     tenant's chain contiguous and linked.
--   * BEFORE UPDATE OR DELETE row trigger and BEFORE TRUNCATE statement trigger using shiyan.reject_mutation().
--   * REVOKE from PUBLIC; GRANT SELECT, INSERT to shiyan_app when that role exists (no UPDATE/DELETE).
--
-- Idempotent: safe to re-run. Contains no data and no secrets. Does not alter shiyan.experiences,
-- shiyan.reference_envelopes or any other table. Not applied automatically; the owner must run it.

BEGIN;

CREATE SCHEMA IF NOT EXISTS shiyan;

CREATE OR REPLACE FUNCTION shiyan.reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append-only table %.%: % is not permitted', TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END
$$;

CREATE TABLE IF NOT EXISTS shiyan.state_segments (
  tenant_id            text        NOT NULL CHECK (tenant_id ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  seq                  integer     NOT NULL CHECK (seq >= 0),
  segment_sha256       text        NOT NULL CHECK (segment_sha256 ~ '^[0-9a-f]{64}$'),
  prev_segment_sha256  text        CHECK (prev_segment_sha256 IS NULL OR prev_segment_sha256 ~ '^[0-9a-f]{64}$'),
  segment_json         text        NOT NULL CHECK (octet_length(segment_json) <= 4194304),
  point_count          integer     NOT NULL CHECK (point_count >= 1),
  source_ids           text[]      NOT NULL,
  window_opened_at     timestamptz NOT NULL,
  window_closed_at     timestamptz NOT NULL,
  closed_by            text        NOT NULL CHECK (closed_by IN ('full', 'cutoff')),
  segment_size         integer     NOT NULL CHECK (segment_size >= 1),
  cutoff_ms            bigint      CHECK (cutoff_ms IS NULL OR cutoff_ms > 0),
  grace_ms             bigint      NOT NULL CHECK (grace_ms >= 0),
  loss_mode            text        NOT NULL CHECK (loss_mode IN ('lossless', 'bounded')),
  eps_predicted        double precision,
  eps_observed         double precision,
  eps_phi              double precision,
  context_sha256       text        CHECK (context_sha256 IS NULL OR context_sha256 ~ '^[0-9a-f]{64}$'),
  created_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, seq),
  CONSTRAINT state_segments_sha256_unique UNIQUE (segment_sha256),
  CONSTRAINT state_segments_sha256_matches CHECK (segment_sha256 = encode(sha256(convert_to(segment_json, 'UTF8')), 'hex')),
  CONSTRAINT state_segments_tenant_matches CHECK ((segment_json::jsonb ->> 'tenant_id') = tenant_id),
  CONSTRAINT state_segments_seq_matches CHECK ((segment_json::jsonb ->> 'seq') = seq::text),
  CONSTRAINT state_segments_count_matches CHECK ((segment_json::jsonb ->> 'count') = point_count::text
    AND cardinality(source_ids) = point_count AND point_count <= segment_size),
  CONSTRAINT state_segments_prev_matches CHECK ((segment_json::jsonb ->> 'prev_segment_sha256') IS NOT DISTINCT FROM prev_segment_sha256),
  CONSTRAINT state_segments_first_has_no_prev CHECK ((seq = 0) = (prev_segment_sha256 IS NULL)),
  CONSTRAINT state_segments_loss_matches CHECK ((segment_json::jsonb -> 'loss' ->> 'mode') = loss_mode),
  CONSTRAINT state_segments_eps_shape CHECK (
    (loss_mode = 'lossless' AND eps_predicted IS NULL AND eps_observed IS NULL AND eps_phi IS NULL)
    OR (loss_mode = 'bounded' AND eps_predicted > 0 AND eps_observed > 0 AND eps_phi > 0)),
  CONSTRAINT state_segments_context_shape CHECK ((context_sha256 IS NULL) = ((segment_json::jsonb -> 'context') IS NULL)),
  CONSTRAINT state_segments_window_order CHECK (window_opened_at <= window_closed_at)
);

CREATE INDEX IF NOT EXISTS state_segments_tenant_closed_idx
  ON shiyan.state_segments (tenant_id, window_closed_at);

CREATE OR REPLACE FUNCTION shiyan.state_segments_link_check() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.seq = 0 THEN
    IF NEW.prev_segment_sha256 IS NOT NULL THEN
      RAISE EXCEPTION 'state_segments: seq 0 must not have a previous segment' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM shiyan.state_segments s
     WHERE s.tenant_id = NEW.tenant_id AND s.seq = NEW.seq - 1 AND s.segment_sha256 = NEW.prev_segment_sha256
  ) THEN
    RAISE EXCEPTION 'state_segments: seq % must link to the tenant''s segment seq %', NEW.seq, NEW.seq - 1
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE TRIGGER state_segments_link_check
  BEFORE INSERT ON shiyan.state_segments
  FOR EACH ROW EXECUTE FUNCTION shiyan.state_segments_link_check();

CREATE OR REPLACE TRIGGER state_segments_no_update_delete
  BEFORE UPDATE OR DELETE ON shiyan.state_segments
  FOR EACH ROW EXECUTE FUNCTION shiyan.reject_mutation();

CREATE OR REPLACE TRIGGER state_segments_no_truncate
  BEFORE TRUNCATE ON shiyan.state_segments
  FOR EACH STATEMENT EXECUTE FUNCTION shiyan.reject_mutation();

REVOKE ALL ON shiyan.state_segments FROM PUBLIC;
REVOKE ALL ON FUNCTION shiyan.state_segments_link_check() FROM PUBLIC;

DO $grant_shiyan_app_state_segments$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shiyan_app') THEN
    GRANT USAGE ON SCHEMA shiyan TO shiyan_app;
    GRANT SELECT, INSERT ON shiyan.state_segments TO shiyan_app;
  END IF;
END
$grant_shiyan_app_state_segments$;

COMMIT;

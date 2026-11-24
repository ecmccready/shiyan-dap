-- UNAPPLIED. Not run against any database, including production Neon.
-- Adds two new tables. It does not ALTER shiyan.state_segments and does not change
-- any existing column. scp4d_segment_streams holds an optional S4DI sidecar beside a
-- sealed segment. hw_receipts holds a signed hardware proof receipt. Neither table
-- is a Level 4 store. Power is needs real board. No PHI.
--
-- Apply only on a non-production database, as the owner:
--   psql "$SHIYAN_STORAGE_OWNER_URL" -v ON_ERROR_STOP=1 -f db/migrations/007_shiyan_hw_receipts.sql

BEGIN;

CREATE SCHEMA IF NOT EXISTS shiyan;

CREATE TABLE IF NOT EXISTS shiyan.scp4d_segment_streams (
  tenant_id       text        NOT NULL,
  seq             integer     NOT NULL CHECK (seq >= 0),
  segment_sha256  text        NOT NULL CHECK (segment_sha256 ~ '^[0-9a-f]{64}$'),
  stream_sha256   text        NOT NULL CHECK (stream_sha256 ~ '^[0-9a-f]{64}$'),
  stream_bytes    bytea       NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, seq)
);

CREATE TABLE IF NOT EXISTS shiyan.hw_receipts (
  workload_id        text        NOT NULL,
  commit_sha         text        NOT NULL CHECK (commit_sha ~ '^[0-9a-f]{40}$'),
  bitstream_sha256   text        NOT NULL CHECK (bitstream_sha256 ~ '^[0-9a-f]{64}$'),
  config_json        text        NOT NULL,
  hardware_target    text        NOT NULL,
  conditions_json    text        NOT NULL,
  input_sha256       text        NOT NULL CHECK (input_sha256 ~ '^[0-9a-f]{64}$'),
  output_sha256      text        NOT NULL CHECK (output_sha256 ~ '^[0-9a-f]{64}$'),
  golden_sha256      text        NOT NULL CHECK (golden_sha256 ~ '^[0-9a-f]{64}$'),
  bit_exact          boolean     NOT NULL,
  signature_hex      text        NOT NULL CHECK (signature_hex ~ '^[0-9a-f]{128}$'),
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (signature_hex)
);

REVOKE ALL ON shiyan.scp4d_segment_streams FROM PUBLIC;
REVOKE ALL ON shiyan.hw_receipts FROM PUBLIC;

COMMIT;

-- Shiyan DAP: 4D state compression M5. Independent witness for each tenant's persisted state-chain head.
-- Apply to the SAME independent ANCHORS Neon project as 001_shiyan_anchors.sql / 002 (e.g. shiyan-anchors),
-- NOT the storage project, as that project's owner (e.g. neondb_owner), after 001 has been applied:
--   Neon SQL Editor of the anchors project: paste this file and run it, or
--   psql "$SHIYAN_ANCHOR_OWNER_URL" -v ON_ERROR_STOP=1 -f db/migrations/005_shiyan_state_chain_anchors.sql
-- Plain SQL only: no psql \gset / \if. Safe to paste into the Neon SQL Editor.
--
-- What it does:
--   * CREATE TABLE IF NOT EXISTS shiyan_anchor.state_chain_anchors: one row per anchored chain head,
--     PK (tenant_id, seq). chain_head is the segment_sha256 of shiyan.state_segments row (tenant_id, seq) in the
--     storage project; segment_count = seq + 1. Rows are written only by scripts/anchor-state-chain.ts --write.
--   * BEFORE UPDATE OR DELETE row trigger and BEFORE TRUNCATE statement trigger using the 001 function
--     shiyan_anchor.reject_mutation() (tgtype 27 and 34).
--   * REVOKE from PUBLIC; GRANT SELECT, INSERT to the anchor app role(s) that exist: shiyan_anchor (production)
--     and/or shiyan_anchor_app (001). No UPDATE/DELETE. The storage role shiyan_app gets nothing here.
--
-- Additive only: does not alter or drop reference_anchors, recovery_records, functions or roles.
-- Idempotent: safe to re-run. Contains no data and no secrets. Not applied automatically; the owner must run it.

BEGIN;

CREATE TABLE IF NOT EXISTS shiyan_anchor.state_chain_anchors (
  tenant_id      text        NOT NULL CHECK (tenant_id ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  seq            integer     NOT NULL CHECK (seq >= 0),
  chain_head     text        NOT NULL CHECK (chain_head ~ '^[0-9a-f]{64}$'),
  segment_count  integer     NOT NULL CHECK (segment_count = seq + 1),
  anchored_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, seq)
);

-- Append-only: reuse the 001 trigger function (must already exist in this schema).
CREATE OR REPLACE TRIGGER state_chain_anchors_no_update_delete
  BEFORE UPDATE OR DELETE ON shiyan_anchor.state_chain_anchors
  FOR EACH ROW EXECUTE FUNCTION shiyan_anchor.reject_mutation();

CREATE OR REPLACE TRIGGER state_chain_anchors_no_truncate
  BEFORE TRUNCATE ON shiyan_anchor.state_chain_anchors
  FOR EACH STATEMENT EXECUTE FUNCTION shiyan_anchor.reject_mutation();

REVOKE ALL ON shiyan_anchor.state_chain_anchors FROM PUBLIC;

COMMIT;

-- Grant only when the role exists, so this runs in the SQL Editor without psql conditionals or creating roles.
DO $grant_state_chain_shiyan_anchor$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shiyan_anchor') THEN
    GRANT USAGE ON SCHEMA shiyan_anchor TO shiyan_anchor;
    GRANT SELECT, INSERT ON shiyan_anchor.state_chain_anchors TO shiyan_anchor;
  END IF;
END
$grant_state_chain_shiyan_anchor$;

DO $grant_state_chain_shiyan_anchor_app$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shiyan_anchor_app') THEN
    GRANT USAGE ON SCHEMA shiyan_anchor TO shiyan_anchor_app;
    GRANT SELECT, INSERT ON shiyan_anchor.state_chain_anchors TO shiyan_anchor_app;
  END IF;
END
$grant_state_chain_shiyan_anchor_app$;

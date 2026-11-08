# Tenant boundary and authorized GitHub connection

## Tenant authentication (required; fails closed)
- `AETHEL_TENANT_KEYS`: JSON object mapping tenant id to the **sha256 hex of that tenant's API key**,
  e.g. `{"acme":"<sha256 hex>"}`. Tenant ids match `^[a-z0-9][a-z0-9-]{0,39}$`. Raw keys are never stored.
  Generate a hash with: `printf '%s' "$KEY" | sha256sum`.
- Callers send `Authorization: Bearer <key>` (16–256 chars of `A-Za-z0-9._~-`).
- Unset or invalid config: 503 `AUTH_NOT_CONFIGURED`. Missing or unknown key: 401 `UNAUTHENTICATED`.
- The tenant always comes from the key. Body fields such as `tenant_id`/`tenant` are rejected, and headers like `x-tenant-id` are ignored.

Protected: `POST /api/v1/runs`, `GET /api/v1/runs/{id}`, `POST /api/v1/proof`, telemetry `auto_proof` storage
(unauthenticated telemetry still computes and returns a verdict but stores nothing), `POST/GET /api/v1/references`, `GET /api/v1/references/{id}`.

Storage: each tenant has its own directory, `<AETHEL_HF_MEMORY_ROOT>/tenants/<tenant>/`. Run ids are derived from
tenant + workbench + run_id. Another tenant's id returns the same 404 as an unknown id.

## GitHub reference connection (read-only)
- `AETHEL_GITHUB_TOKEN`: server-side read-only token (a fine-grained PAT with Contents: read and Metadata: read on the allowlisted repos only).
- `AETHEL_GITHUB_REPOS`: JSON object mapping `owner/repo` to its owning tenant, e.g. `{"ecmccready/shiyan-dap":"founder"}`.
- `POST /api/v1/references {"repo":"owner/name","ref":"main"}` reads only from `api.github.com/repos/<allowlisted repo>`:
  the commit, the tree (paths and git shas, with secret-looking paths excluded), the last 20 commits, and sha256 hashes of the
  contract files (`src/core/*` interfaces, schema and contracts) and evidence files (`docs/*.md`, `fixtures/*.json`, README).
  File contents are hashed, never stored or executed. Snapshots are immutable per (repo, commit) and owned by the tenant.
- `GET /api/v1/github` gives public status: booleans and counts only.
- Founder snapshot `fixtures/references/shiyan-dap-<commit>.json` was produced with `scripts/snapshot-founder-reference.ts`
  through the operator's `gh` CLI. That CLI login is not an app credential.

## Limitations
- Storage is local files. On Vercel without `AETHEL_HF_MEMORY_ROOT` it is per-instance `/tmp`, so data does not outlast the instance.
- The legacy founder store (`<root>/founder-z`, read by `/api/flywheel`, `/api/self` and `/api/ab`) is founder-only and never holds tenant data.
- Level 4 routes and `src/lib/level4/*` are out of scope and unchanged. `/api/marketplace/listings` and `/api/diagnostics/global-snapshot`
  read the Level 4 experience store without tenant scoping. That store is not a tenant store, but those routes are not tenant-aware.

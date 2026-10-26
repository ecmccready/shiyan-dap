# Micro-ledger API

Endpoint: `/api/v1/ledger/commit`. Storage is Upstash Redis (list `ledger:events`) when `UPSTASH_KV_REST_API_URL` and `UPSTASH_KV_REST_API_TOKEN` are set, else per-instance memory. Settlement is internal and off-chain.

## Commit (`POST`)

Required: `domain`, `assetId`, `stateData.metadataHash`. `eventId`, `version`, `timestamp` are filled in if missing. `previousHash` is always set by the server to the latest event of the same asset. Optional `settlementRail`: `INTERNAL_MICRO` (default), `STRIPE`, `X_MONEY`. Writes are limited to 20 per IP per hour (429).

### Signatures

`signature` = hex HMAC-SHA256 of `assetId|domain|timestamp|metadataHash`, keyed with `LEDGER_SIGNING_SECRET`.
Include the same `timestamp` in the body.

- Valid signature: stored with `signatureStatus: "verified"`.
- Missing or `"unsigned"`: accepted, stored as `"unverified"` (so existing callers keep working).
- Present but wrong: rejected with 400 `invalid signature`.
- Commits made by the server itself (`/api/v1/diagnostics/scan`, plugin tool execute) are signed by the server and are `verified`.

If `LEDGER_SIGNING_SECRET` is unset a public dev secret is used (`GET` reports `signing: "dev-default"`), so a verified signature then proves only integrity of format, not origin. TODO: public-key or wallet signatures.

```bash
SECRET=...; TS=$(($(date +%s)*1000)); CANON="a1|DIAGNOSTIC_AUDIT|$TS|cert_x"
SIG=$(printf %s "$CANON" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $NF}')
curl -X POST $HOST/api/v1/ledger/commit -H 'content-type: application/json' \
  -d "{\"domain\":\"DIAGNOSTIC_AUDIT\",\"assetId\":\"a1\",\"timestamp\":$TS,\"signature\":\"$SIG\",\"stateData\":{\"metadataHash\":\"cert_x\"}}"
```

### Settlement

If `stateData.splitRule` is present (must sum to 100) a settlement intent is stored on the event (`settlement`): `INTERNAL_MICRO` is `SETTLED_INTERNAL`; `STRIPE` and `X_MONEY` are `QUEUED` (logged and appended to `ledger:settlement-queue`). No payment provider is called yet. The response includes `settlementRail`, `settlement` and `signatureStatus`.

## Read (`GET ?limit=N`)

Visible event count and the latest events (max 50), plus `signing` mode. Soft-deleted assets are excluded.

## Admin (soft delete)

Requires the env var `LEDGER_ADMIN_SECRET` (admin is disabled with 503 when it is unset) and the header `x-admin-secret`. Attempts are rate limited.

```bash
# hide every event of an asset (events stay in storage)
curl -X DELETE "$HOST/api/v1/ledger/commit?assetId=live-test-20261025" -H "x-admin-secret: $LEDGER_ADMIN_SECRET"
# restore it
curl -X DELETE "$HOST/api/v1/ledger/commit?assetId=live-test-20261025&restore=1" -H "x-admin-secret: $LEDGER_ADMIN_SECRET"
# list including hidden (flagged hidden:true)
curl "$HOST/api/v1/ledger/commit?includeHidden=1&limit=50" -H "x-admin-secret: $LEDGER_ADMIN_SECRET"
```

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

### Signature type

Optional `signatureType`: `"hmac"` (default, behavior above) or `"wallet"`. A wallet signature is stored as-is with `signatureStatus: "wallet_unverified"` and is never treated as verified. TODO: verify via EIP-191 / SIWE (recover the address from the signature over the canonical string and match it to the asset owner).

### Settlement

If `stateData.splitRule` is present (must sum to 100) a settlement intent is stored on the event (`settlement`) and `settlementRef` (provider id or queue reason) is returned. Optional body fields: `settlementRail` (`INTERNAL_MICRO` default, `STRIPE`, `X_MONEY`), `settlementAmountCents` (integer 50 to 1,000,000) and `settlementCurrency` (default `usd`).

| Rail | Result |
|---|---|
| `INTERNAL_MICRO` | `SETTLED_INTERNAL`, no external payment |
| `STRIPE` | `CREATED` with `providerId` (a PaymentIntent `pi_...`) only if ALL hold: `STRIPE_SECRET_KEY` set, valid amount, the commit's signature is `verified`, and for `sk_live_` keys `LEDGER_SIGNING_SECRET` is set. Otherwise `QUEUED` with `reason`: `stripe_key_missing`, `amount_missing_or_invalid`, `signature_unverified`, `live_key_requires_signing_secret` or `stripe_error` |
| `X_MONEY` | `QUEUED`, reason `x_money_not_integrated` (no integration exists in this repo) |

The Stripe call creates one unconfirmed PaymentIntent for the total (idempotency key `ledger_<txHash>`, `transfer_group` = txHash, metadata with the splits). No charge happens and no money reaches recipients: per-recipient amounts are only recorded in `plannedTransfers`. Queued intents are also appended to `ledger:settlement-queue`.

## Read (`GET ?limit=N`)

Visible event count and the latest events (max 50), plus `signing` mode. Soft-deleted assets are excluded.

## Admin

Requires the env var `LEDGER_ADMIN_SECRET` (admin is disabled with 503 when it is unset) and the header `x-admin-secret`. Attempts are rate limited.

| Call | Effect |
|---|---|
| `DELETE ?assetId=ID` | Soft delete (default): hides the asset's events from reads; they stay in storage and can be restored |
| `DELETE ?assetId=ID&restore=1` | Unhides |
| `DELETE ?assetId=ID&purge=1` | Hard purge: permanently removes the asset's events, queued settlements, chain head and hidden flag. Irreversible. Does not undo anything already created at Stripe |
| `GET ?includeHidden=1&limit=50` | Lists events including hidden assets (flagged `hidden:true`) |

```bash
curl -X DELETE "$HOST/api/v1/ledger/commit?assetId=live-test-20261025" -H "x-admin-secret: $LEDGER_ADMIN_SECRET"
curl -X DELETE "$HOST/api/v1/ledger/commit?assetId=live-test-20261025&purge=1" -H "x-admin-secret: $LEDGER_ADMIN_SECRET"
```

## Music Studio one-action asset flow

Tool `music-studio.create_music_asset`: registers a MUSIC_TRACK (title, optional `durationSeconds`, optional `splitRule`), runs the mock diagnostics scan on it, and commits a DIAGNOSTIC_AUDIT event carrying the same `splitRule`. Both are server-signed and chained (`audit.previousHash` = track `txHash`). Settlement (`settlementRail`, `settlementAmountCents`, `settlementCurrency`) applies to the track event only; the audit event settles internally so an external rail runs once. Writes count against the 20 per hour per IP limit (two per call).

```bash
curl -X POST $HOST/api/v1/plugins/tools/execute -H 'content-type: application/json' -d '{
  "pluginId": "music-studio", "toolName": "create_music_asset",
  "args": {"title": "Night Drive", "durationSeconds": 200,
           "splitRule": [{"account": "acct_a", "percentage": 70}, {"account": "acct_b", "percentage": 30}]}}'
```

The response has `result` (assetId, trackTxHash, auditTxHash, audit, reasons), `ledgerTxHashes` and `ledgerRecords` (full records with `previousHash`, `signatureStatus`, `settlementRef`, `settlement`). In the UI, the Music Studio panel has a "Create asset with splits" form (needs `?demo=1`).

## Agents and MCP

Plugin tools are available on the existing MCP endpoint `POST /api/mcp` without touching the Level 4 handler. Tool names are `<pluginId>__<toolName>`.

- Discover (opt-in so the default list is unchanged): `POST /api/mcp?plugins=1` with `{"jsonrpc":"2.0","id":1,"method":"tools/list"}`. The Level 4 tools come first, then `music-studio__describe_track`, `music-studio__register_track`, `music-studio__create_music_asset`, `diagnostics-safety__run_diagnostic_scan`.
- Call (works on `/api/mcp` with or without `?plugins=1`):

```json
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"music-studio__register_track","arguments":{"title":"Night Drive"}}}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"diagnostics-safety__run_diagnostic_scan","arguments":{"assetId":"trk_1","assetType":"AUDIO","contentHash":"<sha256>","title":"Night Drive"}}}
```

The result is a standard MCP tool result; `structuredContent` has `result`, `ledgerTxHashes` and `ledgerRecords`. Errors (bad args, rate limit) return `isError: true`. The same tools are listed read-only at `GET /api/v1/plugins/tools` and run over plain HTTP at `POST /api/v1/plugins/tools/execute`. In-process callers can use `workbenchRegistry.getAllTools()`.

## Mock diagnostics scoring

`POST /api/v1/diagnostics/scan` and the scan tool accept optional `metadata` (`title`, `text`, `durationSeconds`) and return extra `reasons`. The `DiagnosticAuditResult` shape is unchanged. The score is deterministic: 0 to 0.04 from the contentHash, plus 0.07 per derivative keyword (remix, cover, sample, bootleg, mashup, karaoke, feat., official, ...), 0.04 for audio under 15 seconds, 0.03 for text over 5000 chars, and 0.10 per risky keyword for MODEL_PROMPT. Under 0.15 is PASSED, under 0.30 FLAGGED, else REJECTED. Risk is LOW under 0.10, MEDIUM under 0.25, else HIGH. Ledger audit status is PASSED or FAILED. Still a mock, not a real fingerprint.

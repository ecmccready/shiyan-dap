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

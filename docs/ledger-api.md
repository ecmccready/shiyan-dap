# Micro-ledger API

Endpoint: `/api/v1/ledger/commit`. Storage is Upstash Redis (list `ledger:events`) when `UPSTASH_KV_REST_API_URL` and `UPSTASH_KV_REST_API_TOKEN` are set, else per-instance memory. Events are signed and hash-chained per asset in this off-chain micro-ledger; they are not published to or anchored on a blockchain. Settlement is internal and off-chain.

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

Optional `signatureType`: `"hmac"` (default, behavior above) or `"wallet"`.

Wallet signatures use a basic EIP-191 `personal_sign` check (via `@noble/curves` and `@noble/hashes`; not full SIWE). Contract wallets can be checked with EIP-1271 when `ETH_RPC_URL` is set (see below). Send:
- `signature`: 65-byte hex (`r||s||v`, 130 hex chars, `0x` optional; `v` may be 27/28 or 0/1)
- `walletAddress`: the address claiming to have signed
- `timestamp`: required, so the signature is bound to the event
- `walletMessage` (optional): the signed text. It must contain the canonical string `assetId|domain|timestamp|metadataHash`. If omitted, the signed message is exactly the canonical string.

The server recovers the signer address and compares it to `walletAddress`. Result in `signatureStatus` (stored on the event and returned, never a rejection):

| Status | Meaning |
|---|---|
| `wallet_verified` | the signer matches `walletAddress` (also returned as `walletAddress`) |
| `wallet_siwe_verified` | only when a `siweMessage` is present: the EIP-191 check passed AND `siwe.structureValid` is true (domain, freshness, nonce checks all clean, no replay) AND the nonce was issued by `GET /api/v1/siwe/nonce` and consumed by this commit |
| `wallet_siwe_partial` | a `siweMessage` is present and the EIP-191 check passed, but a SIWE issue exists or the nonce was not server-issued; `signatureReason` lists the gaps (for example `nonce_not_server_issued; domain_not_allowed (...)`) |
| `eip1271_verified` | `contractWallet: true`, `ETH_RPC_URL` set, and the wallet contract returned the EIP-1271 magic value (see below) |
| `eip1271_failed` | `contractWallet: true`, RPC configured, but the check failed; the reason is in `signatureReason` |
| `eip1271_unsupported` | `contractWallet: true` and no RPC configured; nothing is verified |
| `wallet_unverified` | with `signatureReason`: `signature_not_hex`, `signature_wrong_length`, `timestamp_required_to_bind_signature_to_event`, `walletMessage_must_contain_the_canonical_string`, `walletAddress_missing`, `walletAddress_invalid`, `address_mismatch`, `signature_recovery_failed` |

Optional `siweMessage` (max 2000 chars) is a SIWE-style (EIP-4361) text:
```
example.com wants you to sign in with your Ethereum account:
0xYourAddress

Authorize ledger commit <canonical string>

URI: https://example.com/login
Version: 1
Chain ID: 1
Nonce: k3j5h6g7f8
Issued At: 2026-10-26T12:00:00Z
```
When present it is the signed message (it takes precedence over `walletMessage`) and must still contain the canonical string, for example in the statement, so the signature stays bound to the event. It is parsed into `siwe` on the response and the stored event: `{parsed, structureValid, fields: {domain, address, statement, uri, version, chainId, nonce, issuedAt, expirationTime?, notBefore?, requestId?, resources?}, issues, fullVerification: false}`. Issues flagged: `domain_invalid`, `address_invalid`, `address_differs_from_walletAddress`, `uri_missing`, `version_missing` or `version_not_1`, `chain_id_missing` or `chain_id_not_integer`, `nonce_missing` or `nonce_invalid` (8+ alphanumeric), `issued_at_missing` or `issued_at_not_iso_8601`, `expired`, or `not_siwe_format` when the text does not have the SIWE shape. Policy checks (added to `issues` and to a `siwe.policy` block `{expectedDomains, domainMatches, issuedAtAgeSeconds, issuedAtFresh, nonce, maxAgeSeconds}`):
- Domain: the message domain (case-insensitive, with port) must equal an allowed domain, else `domain_not_allowed`. Allowed domains are, in order: `SIWE_ALLOWED_DOMAINS` (comma-separated `host[:port]`) when set; otherwise a fixed list of `shiyan-dap.vercel.app` plus `VERCEL_PROJECT_PRODUCTION_URL` (set by Vercel, not by the client). The request Host header is no longer trusted by default, so a direct API caller cannot make its own host the expected domain. Consequence: preview deployments and custom domains do not match unless you list them in `SIWE_ALLOWED_DOMAINS`. Backward compatibility: `SIWE_TRUST_REQUEST_HOST=1` adds the request host (`x-forwarded-host` or `host`) as before, and when `NODE_ENV` is not `production` (local `next dev`) the request host is added automatically. Only enable the trust flag if the domain is not a security boundary for you. Domain checks stay informational: a mismatch makes the combined status `wallet_siwe_partial`, it does not reject the commit.
- Freshness: `issuedAt` must be no more than 600 s old (`issued_at_too_old`) and no more than 60 s ahead of the server clock (`issued_at_in_future`); `notBefore` in the future is `not_before_in_future`.
- Chain policy: when the message has an integer Chain ID it is compared with `SIWE_ALLOWED_CHAIN_IDS` (comma-separated integers, default `1,137`). The result is recorded in `siwe.policy` as `chainAllowed` (true, false, or null when there is no usable chainId), `allowedChainIds` and `chainEnforced`. By default this is informational only: a disallowed chain does not change `issues` or the combined status. With `SIWE_ENFORCE_CHAIN=1` a disallowed chain adds `chain_not_allowed (...)` to `issues`, which makes `structureValid` false and the combined status `wallet_siwe_partial`; it still never rejects the commit. This is a stub: the chain id is read from the signed text and nothing is checked on-chain.
- Nonce: required (8+ alphanumeric) and stored on the event in `siwe.fields.nonce`. When the EIP-191 signature verifies, the address and nonce are claimed for 15 minutes (Redis `SET NX`, or per-instance memory); a second verified commit with the same address and nonce gets `nonce_replayed` and `policy.nonce: "replayed"`. A commit whose signature does not verify never claims a nonce, so a bad signature cannot burn someone else's nonce. If the store is unavailable the nonce is `unchecked`.

Cryptographic check (`siwe.cryptoVerified`): with a siweMessage the server records `siwe.cryptoVerified` (boolean) and `siwe.crypto` `{method, signatureValid, recoveredAddress, messageAddressMatches, signedExactText, addressChecksum}`. `cryptoVerified` is true only when (1) the EIP-191 signature recovered an address equal to the claimed `walletAddress` (`signatureValid`), (2) the address line inside the siweMessage equals that recovered address (`messageAddressMatches`), and (3) the signature was checked over exactly the stored siweMessage text (`signedExactText`; the siweMessage takes precedence over `walletMessage`, so a different text fails recovery). For `contractWallet: true` the method is `eip1271`: `signatureValid` means the contract accepted it, there is no recovered address, and the message address must equal the contract address. `addressChecksum` (`valid`, `invalid`, `not_checksummed`) reports the EIP-55 case of the message address and is informational only, so an `invalid` checksum does not change any status. These values are server-computed (a client-supplied `siwe` field is stripped). `cryptoVerified` does not cover domain, nonce, expiry or chain policy (see `structureValid` and `policy`), so it is not full SIWE verification: `fullVerification` stays `false`. It does feed the combined status: when `cryptoVerified` is `false`, `signatureStatus` is `wallet_siwe_partial` and `signatureReason` starts with `siwe_crypto_not_verified (...)` listing which of `siwe_message_not_parsed`, `signature_not_valid`, `message_address_is_not_the_signer` and `signature_not_checked_over_exact_siweMessage` applied. For a contract wallet whose signature the contract accepted (`eip1271_verified`) but whose SIWE message does not name that contract, the status is also downgraded to `wallet_siwe_partial` with the reason. A failed EIP-191 check stays `wallet_unverified`, `eip1271_failed` and `eip1271_unsupported` are unchanged, plain EIP-191 commits without a `siweMessage` are unchanged, and nothing here rejects a commit.

Overall summary (`siwe.overallValid`): one boolean, with `siwe.overallFailures` listing why it is false, computed last in the commit pipeline and returned in the commit response, the stored event and the provenance panel. It is true only when ALL of these hold: `cryptoVerified`; `structureValid` (no issues); the domain is allowed; issuedAt is fresh; the nonce was a first use (`policy.nonce: fresh`) and server-issued (`nonceSource: server_issued`); and the message's chain is in `SIWE_ALLOWED_CHAIN_IDS` (checked even when `SIWE_ENFORCE_CHAIN` is not set). Failure codes: `siwe_message_not_parsed`, `crypto_not_verified`, `structure_invalid`, `policy_not_evaluated`, `domain_not_allowed`, `issued_at_not_fresh`, `nonce_replayed`, `nonce_unchecked`, `nonce_not_server_issued`, `chain_not_allowed`, `chain_unknown`. It is stricter than `wallet_siwe_verified` only on the chain: with the default (unenforced) chain policy a message for a chain outside the list is still `wallet_siwe_verified` but `overallValid` is false. `signatureStatus` is unchanged by it, nothing is rejected because of it, a client-supplied `siwe` field is stripped, and it is not full SIWE verification (no on-chain account check, and for `eip1271` the contract's answer is only as trustworthy as the RPC).

Server-issued nonces: `GET /api/v1/siwe/nonce` returns `{nonce, expiresInSeconds: 600, issuedBy: "server", singleUse: true, store}` (24 hex characters, `Cache-Control: no-store`, rate limited per IP with its own budget). The nonce is stored server-side (Redis `ledger:siwe-issued:<nonce>` with a 600 s TTL, or per-instance memory without Redis, where it only works within one instance) and put in the message's `Nonce:` line. A commit whose EIP-191 signature verifies consumes it (single use); `siwe.policy.nonceSource` is then `server_issued`. A nonce that is unknown, expired or already used is `not_issued`: still accepted for backward compatibility, but the commit is `wallet_siwe_partial`. Set `SIWE_REQUIRE_ISSUED_NONCE=1` to also add a `nonce_not_server_issued` issue (making `structureValid` false). A bad signature never consumes a nonce.

Combined status: with a `siweMessage` the stored `signatureStatus` now folds in both checks, so callers read one field. The raw EIP-191 result is kept alongside as `eip191Status` (`wallet_verified` or `wallet_unverified`) on the event and the response. A failed EIP-191 check stays `wallet_unverified`. Without a `siweMessage`, behavior is unchanged: `wallet_verified` or `wallet_unverified`, and `siwe`/`eip191Status` are null. Neither combined status unlocks Stripe, and neither rejects a commit.

Contract wallets (EIP-1271): send `contractWallet: true` with a wallet commit (a signature and `walletAddress` are required; `walletAddress` is the contract wallet, since a contract has no recoverable key). Behaviour:

- No `ETH_RPC_URL` (or one that is not `https://`): `signatureStatus: "eip1271_unsupported"`, nothing verified, nothing consumed.
- `ETH_RPC_URL` set: one `eth_chainId` call when the SIWE message has a Chain ID (a different chain is `eip1271_failed`, `chain_mismatch`) and one `eth_call` at `latest` with a 5 second timeout to the wallet address.
- Calldata: selector `0x1626ba7e` for `isValidSignature(bytes32 hash, bytes signature)`, then `hash` (the EIP-191 `personal_sign` hash of the signed text, `keccak256("\x19Ethereum Signed Message:\n" + len + text)`), the offset `0x40`, the signature length and the signature padded to 32 bytes. The signed text is `siweMessage`, else `walletMessage`, else the canonical string, and must contain the canonical string; `timestamp` is required.
- Returns `0x1626ba7e...` (the magic value): `eip1271_verified`. Anything else, an empty return (no contract code or no such function), an RPC or HTTP error, a timeout, a bad address, non-hex or over-4096-byte signature: `eip1271_failed` with the reason in `signatureReason`. It never throws and never blocks the commit.
- On `eip1271_verified` with a parsed siweMessage the nonce is claimed and consumed like the EOA path. SIWE issues (domain, age, chain, nonce) are appended to `signatureReason`; check `siwe.structureValid` and `siwe.issues` separately, because `eip1271_verified` itself only says the contract accepted the signature.
- Limitations: one chain (whichever the RPC serves); no ERC-6492 (undeployed or counterfactual wallets come back `eip1271_failed` `empty_return`); no ERC-1271 wrappers such as EIP-712 typed data; the answer is only as trustworthy as the RPC provider; no retries; contract state can change after the commit. Tested only against a mock RPC, not a real chain. `eip1271_verified` does not unlock Stripe.

Not done: full SIWE cryptographic verification, any other on-chain check, and ERC-6492. Full SIWE remains directional, and EIP-1271 is partial (callable with an RPC, untested on a real chain).

A missing signature with `signatureType: "wallet"` is still a 400. `wallet_verified` only proves the signer controls that address; it does not prove the address is allowed to write, so it does NOT unlock Stripe settlement (that needs HMAC `verified`). Existing HMAC callers are unchanged.

### Settlement

If `stateData.splitRule` is present (must sum to 100) a settlement intent is stored on the event (`settlement`) and `settlementRef` (provider id or queue reason) is returned. Optional body fields: `settlementRail` (`INTERNAL_MICRO` default, `STRIPE`, `X_MONEY`), `settlementAmountCents` (integer 50 to 1,000,000) and `settlementCurrency` (default `usd`).

| Rail | Result |
|---|---|
| `INTERNAL_MICRO` | `SETTLED_INTERNAL`, no external payment |
| `STRIPE` | `CREATED` with `providerId` (a PaymentIntent `pi_...`) only if ALL hold: `STRIPE_SECRET_KEY` set, valid amount, the commit's signature is `verified`, and for `sk_live_` keys `LEDGER_SIGNING_SECRET` is set. Otherwise `QUEUED` with `reason`: `stripe_key_missing`, `amount_missing_or_invalid`, `signature_unverified`, `live_key_requires_signing_secret` or `stripe_error` |
| `X_MONEY` | `QUEUED`, reason `x_money_not_integrated` (no integration exists in this repo) |

The Stripe call creates one unconfirmed PaymentIntent for the total (idempotency key `ledger_<txHash>`, `transfer_group` = txHash, metadata with the splits). No charge happens and no money reaches recipients.

Recipient-level records: every intent has `settlement.recipients` (`{account, percentage, amountCents?, status, transferId?, transferSkipped?, transferError?}`; amounts appear when `settlementAmountCents` is given). Status is `settled_internal` for INTERNAL_MICRO, `queued` when nothing external happened, and for a created Stripe PaymentIntent `planned`, `transferred` or `transfer_failed`. When a PaymentIntent exists the stored event also has `planned_transfers: [{account, amountCents, status, transferId?, transferSkipped?, transferError?}]`, and the commit response returns `plannedTransfers` and a `settlementNote`.

### Stripe Transfers to recipients

After the PaymentIntent is created, each recipient is handled in order:

| Recipient | Result |
|---|---|
| Account id like `acct_1AbC...` (Connect), test-mode key, amount at least 1 cent | A Stripe Transfer is created (`transfer_group` = txHash, idempotency key `ledger_<txHash>_t<index>`); status `transferred`, `transferId` = `tr_...` |
| Anything else (not an `acct_` id) | Not attempted: status `planned`, `transferSkipped: "not_connect_account"` |
| Zero amount | `transferSkipped: "zero_amount"` |
| Live-mode key | `transferSkipped: "live_transfers_disabled"` unless `LEDGER_ENABLE_LIVE_TRANSFERS=1` is set |
| Stripe rejects the Transfer (no balance, no permission, account not found) | status `transfer_failed`, `transferError` has the message; the commit still succeeds |

Caveats: the PaymentIntent is unconfirmed, so no customer payment backs the Transfers. In test mode they draw on the test platform balance. In live mode they would move real platform funds, which is why they are off by default. Transfers need a Connect-enabled Stripe account and a key that can create them. With no Connect accounts in the splits the behavior is unchanged from before (everything stays `planned`). For tests only, `STRIPE_API_BASE_URL` points a `sk_test_` key at a local Stripe mock; it is ignored for other keys.

## Read (`GET ?limit=N`)

Visible event count and the latest events (max 50), plus `signing` mode. Soft-deleted assets are excluded.

## Admin

Requires the env var `LEDGER_ADMIN_SECRET` (admin is disabled with 503 when it is unset) and the header `x-admin-secret`. Attempts are rate limited.

| Call | Effect |
|---|---|
| `DELETE ?assetId=ID` | Soft delete (default): hides the asset's events from reads; they stay in storage and can be restored |
| `DELETE ?assetId=ID&restore=1` | Unhides |
| `DELETE ?assetId=ID1,ID2,...&purge=1` | Hard purge (one id or up to 20 comma-separated): permanently removes the asset's events, queued settlements, chain head and hidden flag. Irreversible. Does not undo anything already created at Stripe |
| `GET ?includeHidden=1&limit=50` | Lists events including hidden assets (flagged `hidden:true`) |

```bash
curl -X DELETE "$HOST/api/v1/ledger/commit?assetId=live-test-20261025" -H "x-admin-secret: $LEDGER_ADMIN_SECRET"
curl -X DELETE "$HOST/api/v1/ledger/commit?assetId=live-test-20261025&purge=1" -H "x-admin-secret: $LEDGER_ADMIN_SECRET"
```

## Agent Compute plugin

Tool `agent-compute.record_compute_usage` (args: `model`, `tokens`, optional `computeSeconds`, optional `assetId` to chain records) commits an `AGENT_COMPUTE` event (server-signed; the title holds the usage summary, `duration` holds the compute seconds). Usage is self-reported, not metered. Optional estimate args: `estimatedFlops` (self-reported), or `modelParamsBillions` (FLOPs approximated as 2 x params x tokens when `estimatedFlops` is absent), and `costPer1kTokensUsd` (adds `tokens / 1000 x rate`). When any is given the event record carries `usageEstimate: {estimated: true, metered: false, flops?, costUsd?, basis, note}` (also in the tool result and the commit response). It is always an estimate, never metered, and only server-side plugin tools can set it: a `usageEstimate` in a client commit body is ignored. The estimate is bound to the event through `metadataHash`. Available over `POST /api/v1/plugins/tools/execute`, as `agent-compute__record_compute_usage` on `POST /api/mcp` (listed with `?plugins=1`), and in the Plugins panel (writes need `?demo=1`).

## Music Studio one-action asset flow

Tool `music-studio.create_music_asset`: registers a MUSIC_TRACK (title, optional `durationSeconds`, optional `splitRule`), runs the mock diagnostics scan on it, and commits a DIAGNOSTIC_AUDIT event carrying the same `splitRule`. Both are server-signed and chained (`audit.previousHash` = track `txHash`) in the off-chain micro-ledger; this is not a public blockchain. The audit event preserves the exact diagnostics outcome (`PASSED`, `FLAGGED` or `REJECTED`). Settlement (`settlementRail`, `settlementAmountCents`, `settlementCurrency`) applies to the track event only; the audit event settles internally so an external rail runs once. Writes count against the 20 per hour per IP limit (two per call).

```bash
curl -X POST $HOST/api/v1/plugins/tools/execute -H 'content-type: application/json' -d '{
  "pluginId": "music-studio", "toolName": "create_music_asset",
  "args": {"title": "Night Drive", "durationSeconds": 200,
           "splitRule": [{"account": "acct_a", "percentage": 70}, {"account": "acct_b", "percentage": 30}]}}'
```

The response has `result` (assetId, trackTxHash, auditTxHash, audit, reasons), `ledgerTxHashes` and `ledgerRecords` (full records with `previousHash`, `signatureStatus`, `settlementRef`, `settlement`). In the UI, the Music Studio panel has a "Create track and run diagnostics" form (writes need `?demo=1`).

## Agents and MCP

Plugin tools are available on the existing MCP endpoint `POST /api/mcp` without touching the Level 4 handler. Tool names are `<pluginId>__<toolName>`.

- Discover (opt-in so the default list is unchanged): `POST /api/mcp?plugins=1` with `{"jsonrpc":"2.0","id":1,"method":"tools/list"}`. The Level 4 tools come first, then `music-studio__describe_track`, `music-studio__register_track`, `music-studio__create_music_asset`, `diagnostics-safety__run_diagnostic_scan`, `agent-compute__record_compute_usage`.
- Call (works on `/api/mcp` with or without `?plugins=1`):

```json
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"music-studio__register_track","arguments":{"title":"Night Drive"}}}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"diagnostics-safety__run_diagnostic_scan","arguments":{"assetId":"trk_1","assetType":"AUDIO","contentHash":"<sha256>","title":"Night Drive"}}}
```

The result is a standard MCP tool result; `structuredContent` has `result`, `ledgerTxHashes` and `ledgerRecords`. Errors (bad args, rate limit) return `isError: true`. The same tools are listed read-only at `GET /api/v1/plugins/tools` and run over plain HTTP at `POST /api/v1/plugins/tools/execute`. In-process callers can use `workbenchRegistry.getAllTools()`.

## Mock diagnostics scoring

`POST /api/v1/diagnostics/scan` and the scan tool accept optional `metadata` (`title`, `text`, `durationSeconds`; top-level `title` and `durationSeconds` also work) and return `reasons` and `scoringVersion` (`mock-heuristic-v2`). The client helper `executeDiagnosticScan` accepts the same request fields and returns the audit result, scoring details, simulated fingerprint, and ledger record. The `DiagnosticAuditResult` core shape is unchanged. The result depends only on `contentHash`, `assetType`, `title`, `text` and `durationSeconds` (title and text lowercased and whitespace-normalized), never on time or randomness, so identical inputs give an identical score and `certificateHash` (a SHA-256 over the inputs and verdict). Terms, each listed in `reasons`: 0 to 0.04 from the contentHash (+0.02 if it is too short); +0.07 per derivative keyword in title or text, max 3 (remix, cover, sample, bootleg, mashup, karaoke, feat., official, radio edit, extended mix, live at, slowed, sped up, nightcore, ...); +0.02 for an "Artist - Title" pattern on AUDIO; +0.02 for a missing or very short title; AUDIO duration under 15 s +0.04, over 20 min +0.02, missing +0.01; +0.03 for text over 5000 chars; +0.10 per risky keyword for MODEL_PROMPT, max 2. The last reason states the total and the verdict. Under 0.15 is PASSED, under 0.30 FLAGGED, else REJECTED. Risk is LOW under 0.10, MEDIUM under 0.25, else HIGH. Ledger events preserve the exact status (`PASSED`, `FLAGGED` or `REJECTED`). In the Music Studio flow the contentHash is derived from the title and duration, not the random assetId, so the same track scores the same. Still a mock, not a real fingerprint or compliance check.

### Simulated fingerprint (metadata only, not audio)

**Limitation, read first:** the `fingerprint` is a hash of metadata. No audio is read, decoded or analysed for it, so it cannot match re-encodes, edits or copies of audio, and it must not be used as evidence of originality or infringement. The response says so explicitly: `fingerprintKind: "metadata_simulation"`, and `audioFingerprint: null` with `audioFingerprintStatus: "not_implemented"` and `audioFingerprintNote: "not_implemented: no audio bytes analyzed"` unless audio input is supplied (see the audio hook below), which the Music Studio panel also shows. Hook point for real fingerprinting: `computeAudioFingerprint()` in `src/services/diagnostics-core.ts`. Only the fingerprint and verdict would ever go on the ledger, never the audio, and the last `reasons` line starts with `SIMULATION ONLY`.

Audio hook (optional, content hash only): `POST /api/v1/diagnostics/scan` and the `create_music_asset` tool accept `audioBase64` (base64 or base64url, at most 2 MB decoded) or `audioHash` (64 hex SHA-256, optional `sha256:` prefix). The response `audioFingerprint` is then `sha256:<hex>` with `audioFingerprintStatus` `content_hash_only` (the server hashed the bytes it received) or `content_hash_provided` (the client supplied the hash; unverified), and `audioFingerprintNote` says so. Bytes win over a hash. With neither, or with invalid or oversized input, it stays `null` / `not_implemented` (`not_implemented: no audio bytes analyzed`). A SHA-256 of the file only matches byte-identical files: re-encoding, trimming or retagging changes it, so it is NOT a perceptual or acoustic fingerprint and is no evidence of originality or infringement. `fingerprintKind` stays `metadata_simulation` for the `fingerprint` field. The audio and the hash are not stored on the ledger, and the score and `certificateHash` are unchanged. Real fingerprinting (Chromaprint or a matching API) would replace the body of `computeAudioFingerprint()` in `src/services/diagnostics-core.ts` with a new status such as `computed`.

The scan response, the Music Studio result and the last entry of `reasons` also carry `fingerprint` (`fp_` plus 16 hex) and `fingerprintVersion` (`sim-fp-v1`): a SHA-256 over the normalized title (lowercase, letters and digits only), the duration rounded to whole seconds, and the assetType. It is distinct from `certificateHash` (which also covers assetId, contentHash, text, score and verdict) and is stable across case, punctuation and sub-second duration differences. It is a simulation: a hash of metadata, not an audio fingerprint, and it knows nothing about the audio. It is not part of the `DiagnosticAuditResult` type or the ledger event.

## Anchor root (preparation only)

`GET /api/v1/ledger/anchor?limit=100` (1 to 500) returns a Merkle root over the txHashes of the latest events: `{root, eventCount, anchored: false, algorithm: "sha256-merkle-v1", fromTxHash, toTxHash, store, generatedAt, note}`. Leaf = `sha256("leaf:" + txHash)`, node = `sha256("node:" + left + right)` on hex strings, an odd node is paired with itself, events in ledger order oldest first. `&txHash=0x...` adds `proof.steps` (sibling hash and side per level) for an event in the window. Soft-hidden events are included, so an admin hide does not change the root; a hard purge does. Nothing is submitted on-chain: `anchored` is always false and on-chain submission remains directional.

### Dry-run submission

`POST /api/v1/ledger/anchor` with `{"dryRun": true, "limit": 100}` (`limit` optional) records a DRY-RUN submission of the current root and returns `{attemptId, status: "dry-run", anchored: false, network: "none (dry-run)", root, eventCount, algorithm, fromTxHash, toTxHash, simulatedTxHash, simulatedBlockNumber, attemptedAt, note}`. The tx hash is a SHA-256 of the root, a sequence number and the time; the block number is just the attempt sequence. Neither exists on any chain. Any body without `dryRun: true` is a 400, because there is no chain connection. Each attempt is logged (`[ledger] anchor dry-run ...`), stored in a capped list (latest 50, `ledger:anchor-attempts`) and rate-limited per IP (20 per hour, separate scope). `GET /api/v1/ledger/anchor?attempts=N` lists recent attempts, `GET /api/v1/status` shows the last one as `anchor.lastDryRun`, and the provenance panel has a "Dry-run anchor submission" button (needs `?demo=1`). Real on-chain submission is still directional. The root also appears in `GET /api/v1/status` (`anchor`, latest 100 events) and in the provenance panel.

Optional `network` (case-insensitive: `ethereum`, `sepolia`, `polygon`, `base`, `optimism`, `arbitrum`; anything else is a 400) adds a SIMULATED `receipt` and sets the attempt's `network` to that name. Receipt fields: `simulated: true`, `onChain: false`, `chainId`, `transactionHash` (the simulated tx hash), `blockNumber` (the attempt sequence), `blockHash` (made up), `status: "simulated_success"`, `gasUsed`, `gasUsedBreakdown`, `effectiveGasPriceGwei`, `feeWei`, `feeNative`, `nativeSymbol`, `confirmations: 0`, `logs: []`, `estimateModel` and `note`. Gas model `anchor-gas-model-v1`: 21000 base, plus calldata (4-byte selector and the 32-byte root, 16 gas per non-zero byte and 4 per zero byte), plus 22100 for one new storage slot, plus 3000 overhead (about 46.7k gas for a typical root). The gas prices are fixed illustrative numbers per network, not live market data, and L2 data fees are not modelled, so the fee is only an order-of-magnitude illustration. No RPC is called, no contract exists, and `anchored` stays `false`. Without `network` the response is as before and has no receipt.

## Cleaning up test data

Test assets known on the production ledger: `live-test-20261025`, `trk_7bbda6ed`, `trk_654015ed`, `live-test-exec-20261025`, `live-test-music-20261025`. After `LEDGER_ADMIN_SECRET` is set in Vercel (and redeployed):

```bash
HOST=https://shiyan-dap.vercel.app LEDGER_ADMIN_SECRET=... scripts/purge-test-ledger.sh        # dry run, lists what is there
HOST=https://shiyan-dap.vercel.app LEDGER_ADMIN_SECRET=... scripts/purge-test-ledger.sh --yes  # permanent purge
```

The equivalent single call is `DELETE /api/v1/ledger/commit?assetId=live-test-20261025,trk_7bbda6ed,trk_654015ed,live-test-exec-20261025,live-test-music-20261025&purge=1` with the `x-admin-secret` header. Use soft hide (no `purge=1`) first if you want to be able to restore.

## Status

`GET /api/v1/status` (read-only, no auth, a couple of cheap reads) returns registered plugins (`id`, `name`, `version`, `toolCount`), the ledger summary (`store`, `count` including hidden assets, `latestTxHash`), `config` booleans (`signingSecretConfigured`, `adminSecretConfigured`, `stripeKeyConfigured`, `ledgerStore`; never the values), supported `settlementRails`, `signatureTypes` and the write limit. The Plugins section of the workbench shows it as a collapsible status line.

## Music Studio: optional wallet signature on `create_music_asset`

Default is unchanged: both events (MUSIC_TRACK, DIAGNOSTIC_AUDIT) are server-signed (`verified`, `hmac`, no `siwe`). Optionally, `POST /api/v1/plugins/tools/execute` with `music-studio` / `create_music_asset` accepts `walletAddress`, `signature`, `siweMessage` (or `walletMessage`), `assetId` and `timestamp`. When a signature is present the MUSIC_TRACK event is committed with `signatureType: wallet` instead of the server HMAC, using the normal commit pipeline (EIP-191 recovery, SIWE parse and policy, server nonce, `cryptoVerified`, `overallValid`). The DIAGNOSTIC_AUDIT event stays server-signed because its timestamp and hash come from the scan and cannot be signed in advance.

What you sign: the canonical string `<assetId>|MUSIC_TRACK|<timestamp>|<metadataHash>`, either directly (EIP-191) or inside a SIWE message (for example as its statement). `metadataHash` is the hex SHA-256 of `JSON.stringify({assetId, title, duration, splitRule})` (`duration` and `splitRule` omitted when not used; `title` trimmed; splits as `{account, percentage}`). So `assetId` and `timestamp` must be fixed by the client up front. Input errors return 500 from the tool with a message (signature without `assetId`, `timestamp` or a valid `walletAddress`, or wallet fields without a signature). A bad or mismatched signature does not fail the call: the record is stored `wallet_unverified` or `wallet_siwe_partial` like any wallet commit. A wallet record is never `verified`, so with a STRIPE rail it does not unlock transfers. Not tested with a real browser wallet.

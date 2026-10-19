# Level 4 write gate

`src/lib/level4/write-auth.ts` exports `requireLevel4Write(req)`. It returns `null` to allow a write, or a `401 {"error":"unauthorized"}` response.

## Gated endpoints

| Route | Gated methods | Public methods |
|---|---|---|
| `/api/level4/run` | POST, DELETE | GET |
| `/api/level4/experience` | POST | GET (incl. `?format=ledger`) |
| `/api/level4/acquisition` | POST | GET |
| `/api/memory` | POST (commits to the founder-z HF dataset) | GET |
| `/api/mint` | POST (commits `mints/*.json` to HF when `HF_TOKEN` is set) | — |
| `/api/level4/tensor-check` | — (stateless POST, stores nothing; left public) | GET, POST |

Browser callers of `/api/memory` and `/api/mint` (`src/lib/outcomes.ts`, `src/lib/validation.ts`, `/nfts`, `/outcomes`, `/upload`, `/tokens`) all use relative same-origin `fetch`, so they keep working under the default same-origin rule.

## Environment variables

| Variable | Effect |
|---|---|
| `LEVEL4_WRITE_TOKEN` | Unset: every write is allowed (behavior unchanged). Set: writes need one of the rules below. |
| `LEVEL4_ALLOW_SAME_ORIGIN` | Default on. Set to `false` for strict bearer-only writes. |
| `LEVEL4_ALLOWED_ORIGINS` | Optional comma list of extra hosts/origins accepted by the same-origin rule. |

With `LEVEL4_WRITE_TOKEN` set, a write passes if:

1. `Authorization: Bearer <LEVEL4_WRITE_TOKEN>` matches (constant-time compare), or
2. same-origin is allowed and the `Origin` (or, if absent, `Referer`) host equals the request host, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, or a `LEVEL4_ALLOWED_ORIGINS` entry.

## Important: what the same-origin rule is and is not

The live browser demo (`/workbench/autonomous`) posts from client code and cannot hold a secret, so rule 2 keeps it working. It is **CSRF-style protection** against cross-site and scripted writes from other origins. It is **not strong authentication**: a non-browser client such as `curl` can forge the `Origin` header. For real write protection set `LEVEL4_ALLOW_SAME_ORIGIN=false`; note that this also blocks the browser demo's writes unless they are routed through a server that holds the token.

No env vars are set on Vercel by this change, so production behavior is unchanged until you set them.

```bash
curl -X POST https://<host>/api/level4/experience \
  -H "Authorization: Bearer $LEVEL4_WRITE_TOKEN" -H "Content-Type: application/json" \
  -d '{"run_id":"r1","iteration":1}'
```

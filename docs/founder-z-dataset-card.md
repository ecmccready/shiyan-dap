---
pretty_name: founder-z
license: other
license_name: unspecified
license_link: https://github.com/ecmccready/shiyan-dap
language:
  - en
tags:
  - outcome-learning
  - event-log
  - autonomous-agents
  - shiyan-dap
  - aethel-node
size_categories:
  - n<1K
configs:
  - config_name: outcomes
    data_files:
      - split: train
        path: "outcome-*.json"
  - config_name: events
    data_files:
      - split: train
        path: "events/*.json"
  - config_name: mints
    data_files:
      - split: train
        path: "mints/*.json"
---

# founder-z

> **Historical note.** Records dated before 2026-10-27 come from a music vertical and its mint-queue route, both removed from the app. They are kept as published history only; the app no longer writes mint records or music-related events.

> **Dataset Viewer note.** The Hub's Dataset Viewer shows a `CastError` for this repo because the JSON files have mixed schemas (older and newer outcome files, events, mints and `latest-z.json` differ in shape). The data is intact; load files directly instead:
>
> ```python
> import json, pandas as pd
> from huggingface_hub import hf_hub_download
> path = hf_hub_download("shiyan-dap/founder-z", "latest-z.json", repo_type="dataset")
> print(json.load(open(path)))
>
> # or one file / one glob with datasets:
> from datasets import load_dataset
> ds = load_dataset("json", data_files=hf_hub_download("shiyan-dap/founder-z", "latest-z.json", repo_type="dataset"), split="train")
> ```

## Summary

`shiyan-dap/founder-z` is the public outcome log written by the Shiyan / Aethel Node web app (`shiyan-dap.vercel.app`). Each file is a small JSON record of an action taken in the app's music vertical, with the six-dimension outcome vector before and after the action (`y_before`, `y_after`) and the app's next-action note (`z`). `latest-z.json` holds the most recent `z` and is what the app reads back as its "head z".

Snapshot at the time this card was written (dataset commit `2e51a56`, last modified 2026-09-30):

| Record type | Path | Files |
|---|---|---|
| Outcome | `outcome-m_<epoch ms>.json` | 22 |
| Event | `events/<assetId>.json` | 3 |
| Mint (queued) | `mints/<assetId>.json` | 2 |
| Head pointer | `latest-z.json` | 1 |

All 22 outcome records have `simulated: false`. Each file is one JSON object (not JSON Lines).

## How records are produced

Records are written by the app's own server routes using the Hugging Face commit API (`POST https://huggingface.co/api/datasets/<repo>/commit/main`), authenticated with the server-side `HF_TOKEN`. The target repo is `HF_DATASET`, defaulting to `shiyan-dap/founder-z`. Without `HF_TOKEN`, nothing is written.

- **`POST /api/memory`** (`src/app/api/memory/route.tsx`). If the request body has `kind: "outcome"`, it writes `outcome-<measurement_id>.json`; any other `kind` is stored as `"event"` and written to `events/<assetId or "latest">.json`, overwriting the previous file at that path. Every call also overwrites `latest-z.json` with `{ z, action, agent, at }`. Client callers include `persistOutcome` in `src/lib/outcomes.ts` (outcome rows), `src/lib/validation.ts` (sends `kind: "validation"`, which is stored as an event), `src/app/nfts/page.tsx` (`PROVE_ASSET`) and `src/app/upload/page.tsx` (`upload`).
- **`POST /api/mint`** (`src/app/api/mint/route.ts`) writes `mints/<assetId>.json` with a queued mint record (`state: "queued"`, `chain: "none"`, `tx: null`, `paid: false`). No on-chain mint happens.
- **`GET /api/memory`** and `GET /api/self` read `latest-z.json` back.

Because event and mint files are keyed by asset id and overwritten, those folders hold only the latest record per asset, not a history.

## Schema

### Outcome (`outcome-m_*.json`)

| Field | Type | Notes |
|---|---|---|
| `kind` | string | always `"outcome"` |
| `assetId` | string | e.g. `cl_shiyan_yishu_001`, `cl_sleep_terrors_001`, `self_loop` |
| `action` | string | e.g. `EXECUTE_SETTLEMENT`, `RETURN`, `SELF`, `OBSERVE_AUDIENCE`, `PROPOSE`, `ACK`, `PING_OPEN`, `TRADE_OFFER`, `TRADE_ACCEPT`, `HOLD` |
| `agent` | string | label such as `Agent A · ECMcCready`, `Agent B · potential customer`, `Self()`, `Ping Reference`, `Controlled B · session` |
| `simulated` | bool | |
| `y_before`, `y_after` | object | `{ settlement, acquisition, audience_response, conversion, revenue, retention }`, values observed as 0 or 1 |
| `z` | string | free-text next-action note |
| `at` | string | ISO 8601 UTC timestamp |

### Event (`events/*.json`)

Current `/api/memory` shape: same fields as an outcome with `kind: "event"`; `y_before`/`y_after` are often `null` and `z` often empty. `events/cl_shiyan_yishu_001.json` uses an older, different shape: `assetId, title, action ("founder_test_checkout"), buyer, from, to, state, paid, testPaid, amount, currency, stripePayment, source`. It records a Stripe **test-mode** checkout (`paid: false`, `testPaid: true`).

### Mint (`mints/*.json`)

`assetId, title, action ("mint_queued"), standard ("erc721"), chain ("none"), tx (null), state ("queued"), paid (false)`. The current `/api/mint` code also writes `from, to, at, source`; the two existing files predate that and lack them. Note: both mint files have identical content (`assetId: cl_sleep_terrors_001`), so `mints/cl_shiyan_yishu_001.json` does not describe the asset its filename names.

### `latest-z.json`

`{ z, action, agent, at }`.

## Example record

`outcome-m_1789334846195.json`:

```json
{
  "kind": "outcome",
  "assetId": "cl_sleep_terrors_001",
  "action": "EXECUTE_SETTLEMENT",
  "agent": "Agent B · potential customer",
  "simulated": false,
  "y_before": { "settlement": 0, "acquisition": 1, "audience_response": 0, "conversion": 0, "revenue": 0, "retention": 0 },
  "y_after":  { "settlement": 1, "acquisition": 1, "audience_response": 0, "conversion": 0, "revenue": 0, "retention": 1 },
  "z": "Hold. Measure music again after Act.",
  "at": "2026-09-13T21:27:26.195Z"
}
```

## Personal and health data

- **No PHI and no diagnosis.** The records describe actions on music catalog assets and binary business-outcome flags. "Sleep Terrors" is the title of a song (`cl_sleep_terrors_001`, "Sleep Terrors — Second Single"), not a medical condition of any person, and "misdiagnosis" elsewhere in the project refers to a wrong next action, not a clinical finding.
- **No customer personal data** was found in the files reviewed: no names of customers, emails, addresses or payment-card data. Counterparties appear only as role labels (`potential customer`, `This session`).
- **Disclosed identifiers:** the founder's public handle `ECMcCready` appears in `agent`, `from` and `latest-z.json`, and `events/cl_shiyan_yishu_001.json` contains a Stripe test-mode PaymentIntent id (`stripePayment`).

## Intended uses

- Inspecting and auditing the app's outcome-learning loop: which action was taken and how the outcome vector changed.
- Small-scale experiments on next-action selection from (y_before, action, y_after) transitions.

## Limitations

- **Self-reported.** Records are written by the app itself from client-triggered requests. They are not independently audited, and `simulated: false` is a flag set by the app, not verified.
- **Unauthenticated writer.** `POST /api/memory` has no write gate, so any client of the public site can cause a record to be written.
- **Tiny and single-source.** 22 outcomes from one founder's app over 2026-09-13 to 2026-09-30, with mostly unchanged vectors. Not suitable for training general models.
- **Overwrites.** Event, mint and `latest-z.json` files are overwritten in place; history exists only in the Hub's git log.
- **Mixed shapes** across older and newer files (see Schema).
- No Level 4 experience-store entries (e, Δe, Φ, tensor commitments) are in this dataset; those live in the app's Upstash store and `/api/level4/experience`.

## How to load

```python
from datasets import load_dataset

# Uses the `configs` in this card once it is uploaded as README.md;
# before that, pass data_files="outcome-*.json" instead of "outcomes".
outcomes = load_dataset("shiyan-dap/founder-z", "outcomes", split="train")
print(outcomes[0])
```

Because shapes differ between files, loading `events` or `mints` with `datasets` may fail schema inference. Reading files directly is more robust:

```python
import json
from huggingface_hub import HfApi, hf_hub_download

repo = "shiyan-dap/founder-z"
files = HfApi().list_repo_files(repo, repo_type="dataset")
records = {
    f: json.load(open(hf_hub_download(repo, f, repo_type="dataset")))
    for f in files if f.endswith(".json")
}
```

## Source

Producer code: `github.com/ecmccready/shiyan-dap` (`src/app/api/memory/route.tsx`, `src/app/api/mint/route.ts`).

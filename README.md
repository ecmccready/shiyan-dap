# Shiyan DAP

Shiyan is a creator SaaS platform. It turns creative work into market action.

Shiyan AI Assist is the AI system that helps an independent creator take a creation to release, audience response and next best action.

Music is the first vertical, not the category.

Live: https://shiyan-dap.vercel.app  
Repo: https://github.com/ecmccready/shiyan-dap  
Memory: https://huggingface.co/datasets/shiyan-dap/founder-z

## Position

Creator SaaS. Asset ledger. Transaction loop. Outcome loop.

Do not market Shiyan primarily as a music AI tool.

## Acquisition loop

Create → Prove → Learn → Act

| Step | URL |
|---|---|
| Create | `/upload` |
| Prove | `/nfts` |
| Learn | `/measurements` |
| Act | `/bot` |

`/dashboard` redirects to `/measurements`.

## Optimize this

Learn stores a first-class `OutcomeTransition`:

- `y_before`
- `y_after`
- `delta_y = y_after - y_before`
- `transition_class` (`c`)
- `action`
- `asset_id`
- `timestamp`
- `measurement_id`
- `confidence`

`y` is 1 when the asset is settled, else 0.

| Transition | Class |
|---|---|
| 0 → 1 | positive |
| 1 → 0 | negative |
| 0 → 0 | no_movement |
| 1 → 1 | maintained |

`z` is the next action from the last `c`.

CREATE → MEASURE → x → ACT → MEASURE AGAIN → y_before → y_after → Δy → c → LEARN → Grok + Hy4 → z → ACT

That dataset is the product. Not another model feature. Not a fit slogan.

## Founder catalog

| Asset | ID |
|---|---|
| Shiyan Yishu — First Single | `cl_shiyan_yishu_001` |
| Sleep Terrors — Second Single | `cl_sleep_terrors_001` |

## P2P state machine

Internal ledger. Not a chain.

| Event | Transition |
|---|---|
| LIST | unlisted → listed |
| INITIATE_TRADE | listed → escrow |
| EXECUTE_SETTLEMENT | escrow → settled |
| ABORT | escrow → cancelled |

Settled assets can queue ERC-721, ERC-1155, or SPL on `/tokens`. Queue is not a mint.

## What is proven

- Landing is Create → Prove → Learn → Act
- Two official singles on the internal ledger
- Stripe sandbox checkout works
- Learn records `y_before`, `y_after`, `delta_y`, `c`, and `z`
- Mint queue exists. Chain tx does not

## What is not claimed

- No live paid buyer
- No on-chain mint
- No trained outcome model over many creators
- Network effects are not yet
- Acquisition-ready business is not yet

Fit is not the narrative. The narrative is accumulating outcome transitions.

## Founder Model z

`y,x` Grok fast + `y,x` Hy4 deep = `z` next action.

Memory destination: `shiyan-dap/founder-z`.

## Local

```bash
npm install
npm run dev
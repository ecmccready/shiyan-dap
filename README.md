# Shiyan DAP

Creator operating system. Music is the first vertical.

Live: https://shiyan-dap.vercel.app  
Repo: https://github.com/ecmccready/shiyan-dap  
Memory: https://huggingface.co/shiyan-dap

Shiyan AI Assist helps an independent creator take a creation to release, audience response, and the next best action.

## Loop

Create → Prove → Learn → Act

| Verb | Route | Job |
|---|---|---|
| Create | /upload | ingest a work |
| Prove | /nfts | A container, acquire / buy |
| Learn | /measurements | f(A), f(B), OutcomeTransition, z |
| Act | /bot | consume z |

Places: Marketplace `/marketplace` · Playlist `/playlist` · Songs `/single`

## f(x) → 1

P2P and A/B agents are one function.

x is an agent.
f(x) is Y.settlement.
Target is 1.
gap = 1 − f(x).

| x | Cluster | Container | f(x) |
|---|---|---|---|
| A | cluster:A | container:founder-music | 1 after live $1 settle |
| B | cluster:B | container:new-customer | 0 placeholder |

Machine:

unlisted → listed → escrow → settled | cancelled

LIST · INITIATE_TRADE · EXECUTE_SETTLEMENT · ABORT

f(x) = 1 only at `settled`.

z = pairZ(f(A), f(B)):

- A=1 B=0 → next action is a real B payment
- A=1 B=1 → hold
- A=0 B=0 → Prove, then Buy

Simulate A/B writes `simulated: true`. That is not B.

See `docs/SLICE_v5_emergent_transition.md`.

## A catalog

- `cl_shiyan_yishu_001` Shiyan Yishu — First Single
- `cl_sleep_terrors_001` Sleep Terrors — Second Single

## Live payment (A)

Stripe live account Shiyan Yishu took one **$1.00** successful payment on 13 Sep 2026.

- Production uses `sk_live_`
- Checkout amount $1.00 USD
- Payout **$0.67** expected **21 Sep 2026**
- Buyer is the founder
- Settle URL `/nfts?paid=1&asset=cl_shiyan_yishu_001`

This proves the A rail. It does not prove B or product-market fit.

## Domains

Music, AI Content, Animation, Games, eSports, Real Estate.

Music is live. The others are simulation references.

## OutcomeTransition

`src/lib/outcomes.ts` is the source of truth.

Y vector: settlement, acquisition, audience_response, conversion, revenue, retention.

Honest bits now:

- settlement = 1 when state is `settled`
- acquisition = 1 when `escrow` or `settled`
- audience_response, conversion, revenue stay 0 until a measured non-founder event exists

x is `Y 0→1` or `Y 1→0`.
f(x) is settlement.
z is `nextAction` / `pairZ`.

`getSelfImprovementMetrics()` stays exported so Vercel can build. It is a count. It is not a trained model.

## What is proven

- Vercel production
- Header: Marketplace, Playlist, Songs, Domains, Create, Prove, Learn, Act
- A container on `/nfts` and `/single`
- Learn A/B squares
- Live Stripe $1 on cluster A
- Two founder singles can settle in this browser

## What is not claimed

- no trained model
- no live non-founder buyer
- no product-market fit
- no on-chain mint
- B is not a real customer
- Simulate A/B is not demand

## Local

```bash
npm install
npm run dev
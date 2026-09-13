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
| Learn | /measurements | A/B clusters, OutcomeTransition, z |
| Act | /bot | consume z |

Places: Marketplace `/marketplace` · Playlist `/playlist` · Songs `/single`

## A/B containers

| Cluster | Container | Who | Status |
|---|---|---|---|
| cluster:A | container:founder-music | Agent A · ECMcCready | live founder catalog |
| cluster:B | container:new-customer | Agent B · potential customer | placeholder |

A assets:

- `cl_shiyan_yishu_001` Shiyan Yishu — First Single
- `cl_sleep_terrors_001` Sleep Terrors — Second Single

## Live payment (A)

Stripe live account **Shiyan Yishu** took one **$1.00** successful payment on 13 Sep 2026.

- Rails: live `sk_live_` on Vercel Production
- Amount: $1.00 USD via `/api/checkout`
- Payout: **$0.67** expected **21 Sep 2026**
- Buyer: founder / Agent A
- Site settle URL: `/nfts?paid=1&asset=cl_shiyan_yishu_001`

That proves the A checkout path. It does not prove B.

## Domains

Music, AI Content, Animation, Games, eSports, Real Estate.

Music is live. The others are simulation references.

## P2P State Machine

unlisted → listed → escrow → settled | cancelled

Simulate A/B writes `simulated: true`. That is not a second user.

See `docs/SLICE_v5_emergent_transition.md` for what to implement next.

## OutcomeTransition

`src/lib/outcomes.ts` is the source of truth.

Y vector: settlement, acquisition, audience_response, conversion, revenue, retention.

Honest bits now:

- settlement = 1 when state is `settled`
- acquisition = 1 when `escrow` or `settled`
- audience_response, conversion, revenue stay 0 until a measured non-founder event exists

x is `Y 0→1` or `Y 1→0`. z is `nextAction`.

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
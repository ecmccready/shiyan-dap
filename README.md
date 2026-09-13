# Shiyan DAP

Creator operating system. Music is the first vertical.

Live: https://shiyan-dap.vercel.app  
Repo: https://github.com/ecmccready/shiyan-dap  
Memory: https://huggingface.co/shiyan-dap

Shiyan AI Assist helps an independent creator take a creation to release, audience response, and the next best action.

## Product

The product is not the song.

The product is the decision loop:

    Y_t  --x_t-->  Y_{t+1}
    z_t  =  π(Y_t, x_t)

A creator takes an action x. Shiyan records whether Y moved. Then it names z.

Music is the first vertical used to prove that loop. Marketplace, Playlist, and Songs are places inside the loop, not the product.

What exists now: deterministic π (`pairZ`, `nextAction`).  
What it can become:

    z*_t  =  argmax_z  E[ U(Y_{t+1}) | Y_t, x_t, z ]

z* is not shipped.

## Product-market fit

Fit is not “the single sold.”  
Fit is not founder $1.  
Fit is not Simulate A/B.  
Fit is not clicking **B returned** as Agent A.

Fit for Shiyan:

A person who is not Agent A uses Create → Prove → Learn → Act, pays, leaves, comes back, and a measured Y bit is maintained or moves because of an action they took.

Until that person exists, product-market fit is false.

| Test | Status |
|---|---|
| A live $1 | proven 13 Sep 2026 |
| B live checkout `cluster=B` | proven 13 Sep 2026 |
| B `RETURN` instrument | proven in-browser 13 Sep 2026 |
| Non-founder B on a later day | not proven |
| Learned z* | not proven |

## Loop

Create → Prove → Learn → Act

| Verb | Route | Job |
|---|---|---|
| Create | /upload | ingest a work |
| Prove | /nfts | Buy as A / Buy as B |
| Learn | /measurements | record Y_t → Y_{t+1}, emit z_t |
| Act | /bot | consume z_t |

Places: Marketplace `/marketplace` · Playlist `/playlist` · Songs `/single`

## f(x) → 1

P2P and A/B agents are one function.

| x | Cluster | Container | f(x) |
|---|---|---|---|
| A | cluster:A | container:founder-music | 1 after live $1 |
| B | cluster:B | container:new-customer | 1 after live B checkout in this browser |

Machine: unlisted → listed → escrow → settled | cancelled

f(x) = Y.settlement. Target is 1. gap = 1 − f(x).

z = pairZ(A, B, returned):

- A=1 B=0 → next is a real B payment
- A=1 B=1, no return → Both at 1. B should return and measure.
- A=1 B=1, RETURN → B returned. Hold.

Simulate A/B writes `simulated: true`. That is not B.

See `docs/SLICE_v5_emergent_transition.md`.

## A catalog

- `cl_shiyan_yishu_001` Shiyan Yishu — First Single
- `cl_sleep_terrors_001` Sleep Terrors — Second Single

## Live payments

Stripe live account Shiyan Yishu.

- A: $1.00 on 13 Sep 2026. Payout $0.67 expected 21 Sep 2026.
- B: $1.00 via `/nfts` **Buy as B**. Return URL includes `cluster=B`.
- B return: Learn **B returned** writes `RETURN`, Y `1→1`, z = B returned. Hold.

Rails work. Fit does not, until B is not the founder.

## Domains

Music, AI Content, Animation, Games, eSports, Real Estate.

Music is live. The others are simulation references.

## OutcomeTransition

`src/lib/outcomes.ts` is the source of truth for Y_t → Y_{t+1}.

Y vector: settlement, acquisition, audience_response, conversion, revenue, retention.

Honest bits now:

- settlement = 1 when state is `settled`
- acquisition = 1 when `escrow` or `settled`
- audience_response, conversion, revenue stay 0 until a measured non-founder event exists

`getSelfImprovementMetrics()` stays exported so Vercel can build. It is a count. It is not z*.

## What is proven

- Vercel production
- Header: Marketplace, Playlist, Songs, Domains, Create, Prove, Learn, Act
- A container on `/nfts` and `/single`
- Learn A/B squares
- Live Stripe on A and B checkout
- pairZ after live B
- RETURN instrument → z Hold

## What is not claimed

- no trained policy
- no argmax / expected utility
- no non-founder B on a later day
- no product-market fit
- no on-chain mint
- Simulate A/B is not demand

## Local

```bash
npm install
npm run dev
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

Places:

- Marketplace `/marketplace`
- Playlist `/playlist`
- Songs `/single`

## A/B containers

| Cluster | Container | Who | Status |
|---|---|---|---|
| cluster:A | container:founder-music | Agent A · ECMcCready | live founder catalog |
| cluster:B | container:new-customer | Agent B · potential customer | placeholder |

A holds both official singles:

- `cl_shiyan_yishu_001` Shiyan Yishu — First Single
- `cl_sleep_terrors_001` Sleep Terrors — Second Single

B is a fictional CRM seat until a second live user Create → Prove → Learn → Act.

Prove and Songs wrap A in one expandable box. Learn shows A and B as two squares. z is the next CRM action.

## Domains

Header dropdown: Music, AI Content, Animation, Games, eSports, Real Estate.

Music is live. The others are simulation references only.

## P2P State Machine

unlisted → listed → escrow → settled | cancelled

LIST · INITIATE_TRADE · EXECUTE_SETTLEMENT · ABORT

Simulate A/B writes `simulated: true` rows. That is not a second user.

## OutcomeTransition

`src/lib/outcomes.ts` is the source of truth.

Y vector: settlement, acquisition, audience_response, conversion, revenue, retention.

Honest bits now:

- settlement = 1 only when state is `settled`
- acquisition = 1 when `escrow` or `settled`
- audience_response, conversion, revenue stay 0

x is the transition `Y 0→1` or `Y 1→0`. z comes from `nextAction`.

`getSelfImprovementMetrics()` stays exported so Vercel can build. It is a count. It is not a trained model.

## What is proven

- Vercel production
- Header: Marketplace, Playlist, Songs, Domains, Create, Prove, Learn, Act
- A container on `/nfts` and `/single`
- Learn A/B squares
- Two founder singles can be settled in this browser

## What is not claimed

- no trained model
- no live non-founder buyer
- no on-chain mint
- B is not a real customer
- Simulate A/B is not demand

## Local

```bash
npm install
npm run dev
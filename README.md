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
| Prove | /nfts | list / acquire |
| Learn | /measurements | record OutcomeTransition, Simulate A/B |
| Act | /bot | consume z |

Places:

- Marketplace `/marketplace`
- Playlist `/playlist`
- Songs `/single`

## Domains

Header dropdown:

- Music
- AI Content
- Animation
- Games
- eSports
- Real Estate

Music is live. The others are domain references for A/B simulation. Simulation is not live demand.

## P2P State Machine

Internal ledger only:

unlisted → listed → escrow → settled | cancelled

Triggers:

- LIST
- INITIATE_TRADE
- EXECUTE_SETTLEMENT
- ABORT

Learn runs Simulate A/B as Agent A · ECMcCready and Agent B · this session. Those rows are marked `simulated: true`.

## OutcomeTransition

Single source of truth in `src/lib/outcomes.ts`.

Y is a vector:

- settlement
- acquisition
- audience_response
- conversion
- revenue
- retention

Honest bits today:

- settlement = 1 only when ledger state is `settled`
- acquisition = 1 when `escrow` or `settled`
- audience_response, conversion, revenue stay 0 until a measured event exists

Each record stores:

- y_before
- y_after
- delta_y
- transition_class (`positive` | `negative` | `no_movement` | `maintained`)
- action, vertical, agent, simulated
- z via `nextAction`

`getSelfImprovementMetrics()` stays exported so existing API routes compile. It is a count over stored transitions. It is not a trained model.

## Founder catalog

- Shiyan Yishu — First Single
- Sleep Terrors — Second Single

Stripe sandbox charges are signals. Product-market fit stays false until a non-founder live payment.

Mint queue is internal after settlement. No on-chain ERC-721 / ERC-1155 / SPL tx is claimed.

## What is proven

- Next.js app on Vercel
- Header: Marketplace, Playlist, Songs, Create, Prove, Learn, Act
- Domain dropdown
- Learn records OutcomeTransition
- Act reads z
- Two official singles can sit in settled / mint queued in this browser

## What is not claimed

- no trained creative-market model
- no live non-founder buyer
- no on-chain mint
- no live demand from Simulate A/B
- Brand is not a domain

## Local

```bash
npm install
npm run dev
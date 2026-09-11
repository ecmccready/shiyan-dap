# Shiyan DAP

Shiyan AI Assist is the AI system that helps an independent creator take a creation to release, audience response and next best action.

The first single **Shiyan Yishu** and the second single **Sleep Terrors** are the founder proof. Other users use the same rails without those master files.

Live: https://shiyan-dap.vercel.app  
Repo: https://github.com/ecmccready/shiyan-dap  
Memory: https://huggingface.co/datasets/shiyan-dap/founder-z

## Statement

I am using my first single "Shiyan Yishu" to build and prove Shiyan AI Assist.

Music is the wedge. Every song + story becomes an owned digital asset. Video, writing, and other AI-native work can use the same ledger later.

## Rails

| Surface | URL | Role |
|---|---|---|
| Assist / AI Content | `/` | C2C. Grok fast, then Hy4 deep |
| Create | `/upload` | Title becomes a ledger asset. File optional |
| Prove | `/nfts` | Acquire and Buy |
| Release / Songs | `/single` | SHOW |
| Marketplace | `/marketplace` | KNOW |
| Playlist | `/playlist` | KNOW HOW |
| Measure | `/measurements` | Assets, acquires, fit from data |
| Learn | `/dashboard` | Next best action |
| Track | `/track` | Audience response |
| Act | `/bot` | DO. Grok Bot |
| Protocol | `/tokens` | Tokenize later. Fiat first |

## Proof loop

Upload → Prove → Buy → Marketplace → Playlist → Songs

| Asset | ID |
|---|---|
| Shiyan Yishu — First Single | `cl_shiyan_yishu_001` |
| Sleep Terrors — Second Single | `cl_sleep_terrors_001` |

User A = ECMcCready. User B = this session.

## P2P state machine

Internal ledger. Not a chain.

| Event | Transition |
|---|---|
| LIST | unlisted → listed |
| INITIATE_TRADE | listed → escrow |
| EXECUTE_SETTLEMENT | escrow → settled |
| ABORT | escrow → cancelled |

KNOW = `/marketplace`. KNOW HOW = `/playlist`. SHOW = `/single`. DO = `/bot`.

## What is proven

- Two official singles on the public ledger
- Upload with no file writes a creator card
- Acquire is INITIATE_TRADE
- Buy opens Stripe Checkout at $1.00 per single
- Three sandbox payments succeeded on Shiyan Yishu sandbox
- A/B memory files:
  - https://huggingface.co/datasets/shiyan-dap/founder-z/blob/main/events/cl_shiyan_yishu_001.json
  - https://huggingface.co/datasets/shiyan-dap/founder-z/blob/main/events/cl_sleep_terrors_001.json
- Guitar Pro 8 / Cubase stems can arrive later. Listing does not wait on the WAV

## What is not claimed

- No live paid buyer. Stripe is still test mode
- No on-chain ERC-721 / ERC-1155 / SPL mint yet
- Product-market fit is a later decision from ledger data: uploads, acquires, and non-founder live payments
- Founder sandbox checkout is a signal, not fit
- Two founder test purchases are not a third-person P2P market

## Founder Model z

`y,x` Grok fast + `y,x` Hy4 deep = `z` next action.

First Single checkout + Sleep Terrors checkout = two settled test rows. That is the loop working. It is not fit.

Capital-allocation stays model-agnostic. Memory destination: `shiyan-dap/founder-z`.

## Local

```bash
npm install
npm run dev
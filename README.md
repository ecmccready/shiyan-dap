# Shiyan DAP

Shiyan AI Assist is the AI system that helps an independent creator take a creation to release, audience response and next best action.

The first single **Shiyan Yishu** is the founder proof. Other users use the same rails without that master file.

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
| Release / Songs | `/single` | First Single |
| Marketplace | `/marketplace` | Shelf |
| Playlist | `/playlist` | Transfer |
| Measure | `/measurements` | Assets, acquires, fit from data |
| Learn | `/dashboard` | Next best action |
| Track | `/track` | Audience response |
| Act | `/bot` | Grok Bot |
| Protocol | `/tokens` | Tokenize later. Fiat first |

## Proof loop

Upload → Prove → Buy → Marketplace → Playlist → Songs

Founder asset ID: `cl_shiyan_yishu_001`

## What is proven

- First Single exists as a public ledger record
- Upload with no file writes a creator card to the ledger
- Acquire reserves the asset in this browser
- Buy opens Stripe Checkout for $1.00 Shiyan Yishu — First Single
- Sandbox payment succeeded: `pi_3UEGUPIuGDsvKC7N0hQ71L5g`
- Founder signal: https://huggingface.co/datasets/shiyan-dap/founder-z/blob/main/events/cl_shiyan_yishu_001.json

## What is not claimed

- No live paid buyer. Stripe is still test mode
- No on-chain ERC-721 / ERC-1155 / SPL mint yet
- Product-market fit is a later decision from ledger data: uploads, acquires, and non-founder live payments
- Founder sandbox checkout is a signal, not fit

## Founder Model z

## P2P state machine

Internal ledger. Not a chain.

User A = ECMcCready. User B = this session.

| Event | Transition |
|---|---|
| LIST | unlisted → listed |
| INITIATE_TRADE | listed → escrow |
| EXECUTE_SETTLEMENT | escrow → settled |
| ABORT | escrow → cancelled |

KNOW = `/marketplace`. KNOW HOW = `/playlist`. SHOW = `/single`. DO = `/bot`.

Primary later signal is a non-founder User A → User B live payment. Sandbox $1 is not that signal.

`y,x` Grok fast + `y,x` Hy4 deep = `z` next action.


Capital-allocation stays model-agnostic. Memory destination: `shiyan-dap/founder-z`.

## Local

```bash
npm install
npm run dev
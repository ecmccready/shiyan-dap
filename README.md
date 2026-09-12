# Shiyan DAP

Shiyan is a creator SaaS platform. It turns creative work into market action.

Shiyan AI Assist is the AI system that helps an independent creator take a creation to release, audience response and next best action.

Music is the first vertical, not the category.

Live: https://shiyan-dap.vercel.app  
Repo: https://github.com/ecmccready/shiyan-dap  
Memory: https://huggingface.co/datasets/shiyan-dap/founder-z

## Position

| Dimension | Current state |
|---|---|
| Creator SaaS architecture | Yes |
| Creator asset system | Yes |
| AI workflow | Yes |
| Marketplace infrastructure | Early / prototype |
| Transaction loop | Proven in Stripe sandbox |
| Network effects | Not yet |
| SaaS PMF | Not established |
| Acquisition-worthy thesis | Yes |
| Acquisition-ready business | Not yet |

Do not market Shiyan primarily as a music AI tool.

## Acquisition loop

Create → Prove → Learn → Act

| Step | URL |
|---|---|
| Create | `/upload` |
| Prove | `/nfts` |
| Learn | `/measurements` |
| Act | `/bot` |

`/dashboard` redirects to `/measurements`. Marketplace, Playlist, Songs, and Tokenize support the loop. They are not the first screen.

## Founder catalog

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

Settled assets can queue ERC-721, ERC-1155, or SPL on `/tokens`. Queue is not a mint.

## What is proven

- Landing is Create → Prove → Learn → Act
- Two official singles on the public ledger
- Upload with no file writes a creator card
- Acquire is INITIATE_TRADE
- Buy opens Stripe Checkout at $1.00 per single
- Sandbox payments succeeded on Shiyan Yishu sandbox
- Both official singles can settle on the internal P2P machine
- Both official singles are mint-queued as ERC-721 with chain none and tx null
- Learn is `/measurements`. `/dashboard` redirects there
- Guitar Pro 8 / Cubase stems can arrive later. Listing does not wait on the WAV

## What is not claimed

- No live paid buyer. Stripe is still test mode
- No on-chain ERC-721 / ERC-1155 / SPL mint yet
- Product-market fit is not established
- Network effects are not yet
- Acquisition-ready business is not yet
- The product does not yet learn which actions improve creative-market outcomes. Next action is Grok fast + Hy4 deep

## Founder Model z

`y,x` Grok fast + `y,x` Hy4 deep = `z` next action.

Capital-allocation stays model-agnostic. Memory destination: `shiyan-dap/founder-z`.

## Local

```bash
npm install
npm run dev
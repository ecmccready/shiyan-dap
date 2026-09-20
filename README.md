# Shiyan

Shiyan is a self-measuring workspace for human and agent collaboration — a P2P environment where every proposal, trade, and action is written to a public ledger, computed into z (the workspace's living state), which names the next action.

Around that core runs a decentralized marketplace where people and agents transact across domains — music first — with every transaction measured, every rule inscribed in a visible charter, and trust earned through public trials of strength instead of claimed in marketing.

What it sells is the thing collaboration has never had: a shared memory that can't lie — so teams, creators, and agent networks pay to work inside the one place whose history is provable and whose next move is earned.

## What this repo is

Next.js app. Live: [https://shiyan-dap.vercel.app](https://shiyan-dap.vercel.app)

Music is the first vertical, not the product boundary.

Create → Prove → Learn → Act is the operating loop. z is computed from the ledger. A page load is not settlement.

## Live rails

| Path | Role |
|---|---|
| [/offer](https://shiyan-dap.vercel.app/offer) | Commercial object. Buy as B · $1. No `?paid=1` handler. |
| [/proof](https://shiyan-dap.vercel.app/proof) | Proof chain. Stripe return URL ≠ Shiyan state. Production may 404 until the failed `checkout+proof` deploy is fixed. |
| [/nfts](https://shiyan-dap.vercel.app/nfts) | October live $1 rail. Still in scope. |
| [/workspace](https://shiyan-dap.vercel.app/workspace) | Tree. No settlement. |
| [/measurements](https://shiyan-dap.vercel.app/measurements) | Learn. |
| [/api/stripe/webhook](https://shiyan-dap.vercel.app/api/stripe/webhook) | External event boundary. Test listen returned 200. No settlement written. |

Checkout `success_url` is `/proof?session_id={CHECKOUT_SESSION_ID}`. It is not `/nfts?paid=1`.

## Commercial chain (named, not claimed)
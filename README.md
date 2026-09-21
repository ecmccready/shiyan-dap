# Shiyan

Shiyan is a self-measuring workspace for human and agent collaboration — a P2P environment where every proposal, trade, and action is written to a public ledger, computed into z (the workspace's living state), which names the next action.

Around that core runs a decentralized marketplace where people and agents transact across domains — music first — with every transaction measured, every rule inscribed in a visible charter, and trust earned through public trials of strength instead of claimed in marketing.

What it sells is the thing collaboration has never had: a shared memory that can't lie — so teams, creators, and agent networks pay to work inside the one place whose history is provable and whose next move is earned.

## Repo

Next.js App Router. Live: [https://shiyan-dap.vercel.app](https://shiyan-dap.vercel.app)

The product is z from Self(). B is computed. Music is the first vertical, not the boundary.

Workspace is the $10 container (named, not billed). Buy as B · $1 is the calibration instrument for the same state machine, not a separate NFT store. A page load is not settlement.

## Development this sprint

Shipped on `main` / Production:

- Stripe webhook `/api/stripe/webhook` — signed `checkout.session.completed` sets ping observed=1. `settlement_written` stays false.
- Checkout success goes to `/proof?session_id={CHECKOUT_SESSION_ID}`. No `?paid=1`.
- `/offer` is the commercial object (Buy as B · $1).
- `/proof` displays correlation only.
- `/validation` is written memory of what was observed. Enigma is not a Shiyan object.
- `/loop` is Create → Prove → Learn → Act on one screen.
- `/workspace` predicts B from scale, time, speed, confidence. Endogenous compute vs $1 calibration intent.
- `/workspace/channel` is CH-a (endogenous) vs CH-b (external $1).
- `/ledger` lists predicted vs observed rows.
- `/api/workspace/state` returns the ledger JSON.
- Redis `redis-teal-leaf` (Free 30 MB) is connected. `"kv": true` means `REDIS_URL` is present. Free Redis is RAM-only.
- Webhook appends a CH-b row to that ledger. It does not write settlement.

Control loop in code:
B_pred = f(S, T, V, C)
E_B    = B_observed - B_predif (externalB.exists) B = observed;  z = measure(pred, B)
else                  B = endogenous; z = provisional


Fixed along the way: truncated checkout `catch` (Next 16 parse error). `/nfts` $1 rail remains in scope for October.

## Live

| Path | Role |
|---|---|
| [/workspace](https://shiyan-dap.vercel.app/workspace) | $10 room. Predict / measure. |
| [/workspace/channel](https://shiyan-dap.vercel.app/workspace/channel) | CH-a / CH-b. |
| [/ledger](https://shiyan-dap.vercel.app/ledger) | Record. |
| [/offer](https://shiyan-dap.vercel.app/offer) | Buy as B · $1. |
| [/proof](https://shiyan-dap.vercel.app/proof) | Return URL ≠ paid. |
| [/loop](https://shiyan-dap.vercel.app/loop) | Tight loop. |
| [/validation](https://shiyan-dap.vercel.app/validation) | What was observed. |
| [/nfts](https://shiyan-dap.vercel.app/nfts) | October live rail. |
| [/api/workspace/state](https://shiyan-dap.vercel.app/api/workspace/state) | Ledger JSON. |
| [/api/stripe/webhook](https://shiyan-dap.vercel.app/api/stripe/webhook) | Observe only. |

## Not yet

- Independent B (founder in this browser is still A)
- Market validity of B
- Level 3
- $10 / month Stripe Billing
- VAT / Stripe business-information task
- Dashboard webhook destination
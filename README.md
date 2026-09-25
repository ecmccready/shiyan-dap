# Shiyan

Shiyan is a self-measuring workspace for human and agent collaboration — a P2P environment where every proposal, trade, and action is written to a public ledger, computed into z (the workspace's living state), which names the next action.

Around that core runs a decentralized marketplace where people and agents transact across domains — music first — with every transaction measured, every rule inscribed in a visible charter, and trust earned through public trials of strength instead of claimed in marketing.

What it sells is the thing collaboration has never had: a shared memory that can't lie — so teams, creators, and agent networks pay to work inside the one place whose history is provable and whose next move is earned.

## A and B

- **Workspace A** — controller. Task, policy, evaluator, memory, Self().
- **P2P Workbench B** — environment A acts on. Not a customer.
- **E** — experience memory.
- **z** — measured |B'| after W(B,y). Not an LLM opinion.

## What /workspace demonstrated

Question: can A act on B, measure z, write E, Self(), and choose the next y without the operator typing the action?

Live run on [https://shiyan-dap.vercel.app/workspace](https://shiyan-dap.vercel.app/workspace):

- B₀ = 100. Goal |B| → 0. Actions {+10, +5, −5, −10}.
- Cycles 0–3 explored each action.
- Then A selected −10 repeatedly. |B| fell (example: A12, B=20, z=20).
- `operator_chose_action: false`.

That is the demonstration: A acted on B, z entered E, Self() used E, next y was not typed by you.

That is an **autonomous controller on a 1-D workbench**. It is not a self-training LLM, not SIMA 2, not AGI, not a clinical product.

A → y → B' = W(B,y) → z = |B'| → Self(M ⊕ z) → y'


## Live

| Path | Role |
|---|---|
| [/](https://shiyan-dap.vercel.app) | Home. Workspace / Marketplace / Playlist. Grok Bot. |
| [/workspace](https://shiyan-dap.vercel.app/workspace) | Proof table. |
| [/workbench](https://shiyan-dap.vercel.app/workbench) | P2P B. |
| [/workbench/safety](https://shiyan-dap.vercel.app/workbench/safety) | Diagnostic evidence state. Not a diagnosis. |
| [/api/workspace/proof](https://shiyan-dap.vercel.app/api/workspace/proof) | Cycle JSON. |
| [/nfts](https://shiyan-dap.vercel.app/nfts) | Music $1 rail. |
| [/proof](https://shiyan-dap.vercel.app/proof) | Stripe return ≠ paid. |

## Not yet

Self-improving foundation model, SIMA 2, claimed autonomous AGI, proven global convergence, independent payer as market proof, Level 3, $10 billing, diagnostics product, misdiagnosis elimination, device claim.
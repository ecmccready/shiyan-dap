# Shiyan

Shiyan is a self-measuring workspace for human and agent collaboration — a P2P environment where every proposal, trade, and action is written to a public ledger, computed into z (the workspace's living state), which names the next action.

Around that core runs a decentralized marketplace where people and agents transact across domains — music first — with every transaction measured, every rule inscribed in a visible charter, and trust earned through public trials of strength instead of claimed in marketing.

What it sells is the thing collaboration has never had: a shared memory that can't lie — so teams, creators, and agent networks pay to work inside the one place whose history is provable and whose next move is earned.

## What it is now

- **Workspace A** — front room. Governs, observes, validates. Owns Self() and z.
- **Workbench B** — opened from A. Environment A acts on. Not a customer.
- **Diagnostic Safety Workbench** — created from B. Holds a diagnostic *evidence* state. Does not emit y = diagnosis.
- **Music** — first live vertical. Home rails Create → Prove → Learn → Act. `/nfts` is the $1 launch object.

Top nav: Workspace · Marketplace · Playlist. Protocol is not on `/`.

A_t = .self(M_t, B_t)
B_{t+1} = W(B_t, y_t)
e_t = ΔB_t - P(A_t, M_t, B_t)
z_t = Φ(...)
A_{t+1} = .self(M_t ⊕ z_t, B_{t+1})


On the safety workbench, z is evidence state (completeness, contradiction, missing, uncertainty). y is HOLD / CLINICIAN_REVIEW / ESCALATE. Validated → clinician. Unresolved → escalation. Second-order question: what could make this wrong?

This does not eliminate misdiagnosis. It is not a cleared medical device. Clinical validation is not claimed.

## Live

| Path | Role |
|---|---|
| [/](https://shiyan-dap.vercel.app) | Home. Music rails. No extra Protocol pill. |
| [/workspace](https://shiyan-dap.vercel.app/workspace) | A. Domain + open workbench. |
| [/workbench](https://shiyan-dap.vercel.app/workbench) | B. Create safety workbench. Noise nav. |
| [/workbench/safety](https://shiyan-dap.vercel.app/workbench/safety) | Evidence state instance. |
| [/playlist](https://shiyan-dap.vercel.app/playlist) | Music playlist. |
| [/marketplace](https://shiyan-dap.vercel.app/marketplace) | Marketplace. |
| [/nfts](https://shiyan-dap.vercel.app/nfts) | Music $1 rail. |
| [/proof](https://shiyan-dap.vercel.app/proof) | Return URL ≠ paid. |
| [/api/workbench/diagnostic](https://shiyan-dap.vercel.app/api/workbench/diagnostic) | Evidence JSON. |
| [/api/stripe/webhook](https://shiyan-dap.vercel.app/api/stripe/webhook) | Observe only. |

## Not yet

Independent payer as market proof, Level 3, $10 billing, proven global convergence, diagnostics product, any acquisition, error-elimination claim, device claim.
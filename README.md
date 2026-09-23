# Shiyan

Shiyan is a self-measuring workspace for human and agent collaboration — a P2P environment where every proposal, trade, and action is written to a public ledger, computed into z (the workspace's living state), which names the next action.

Around that core runs a decentralized marketplace where people and agents transact across domains — music first — with every transaction measured, every rule inscribed in a visible charter, and trust earned through public trials of strength instead of claimed in marketing.

What it sells is the thing collaboration has never had: a shared memory that can't lie — so teams, creators, and agent networks pay to work inside the one place whose history is provable and whose next move is earned.

## State

A is the autonomous controller. B is the workbench A acts on. B is not a customer and not an economic counterparty.

A_t      = .self(M_t, B_t)
hatΔB_t  = P(A_t, M_t, B_t)
y_t      = π(A_t, hatΔB_t)
B_{t+1}  = W(B_t, y_t)
e_t      = (B_{t+1} - B_t) - hatΔB_t
z_t      = Φ(B_t, y_t, e_t, G_t)
M_{t+1}  = M_t ⊕ z_t
A_{t+1}  = .self(M_{t+1}, B_{t+1})


Center formula:
A_{t+1} = .self( M_t ⊕ Φ[ B_{t+1} - B_t - P(A_t, M_t, B_t) ], B_{t+1} )
B_{t+1} = W(B_t, A_t)


Observable stand-in, not a theorem:
V_t = e_t²
want V(M_{t+1}, B_{t+1}) < V(M_t, B_t) when e_t ≠ 0
claimed_global_convergence = false


Hierarchy: Workspace contains workbench B. `.self(M,B)` is A. A1 planner, A2 executor, A3 evaluator emit y into B. Observe ΔB / e → z → M → `.self()` ↺

Music is the first vertical (`/nfts`). Misdiagnosis / diagnostics is later domain context, not an owned asset.

## Live

| Path | Role |
|---|---|
| [/workspace](https://shiyan-dap.vercel.app/workspace) | A. Step `.self()`. |
| [/workbench](https://shiyan-dap.vercel.app/workbench) | B. W(B,y). |
| [/self](https://shiyan-dap.vercel.app/self) | Operator. |
| [/agents](https://shiyan-dap.vercel.app/agents) | A1 A2 A3. |
| [/ledger](https://shiyan-dap.vercel.app/ledger) | Record. |
| [/nfts](https://shiyan-dap.vercel.app/nfts) | Music $1 rail. |
| [/proof](https://shiyan-dap.vercel.app/proof) | Return URL ≠ paid. |
| [/api/workspace/step](https://shiyan-dap.vercel.app/api/workspace/step) | GET snapshot / POST one tick. |
| [/api/workspace/state](https://shiyan-dap.vercel.app/api/workspace/state) | Ledger JSON. |
| [/api/stripe/webhook](https://shiyan-dap.vercel.app/api/stripe/webhook) | Observe only. `settlement_written: false`. |

## Not yet

- Proven global convergence (Lyapunov V* )
- Independent payer as market proof
- Level 3
- $10 / month billing
- Diagnostics product
- Any acquisition


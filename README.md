# Shiyan

Shiyan is a self-measuring workspace for human and agent collaboration — a P2P environment where every proposal, trade, and action is written to a public ledger, computed into z (the workspace's living state), which names the next action.

Around that core runs a decentralized marketplace where people and agents transact across domains — music first — with every transaction measured, every rule inscribed in a visible charter, and trust earned through public trials of strength instead of claimed in marketing.

What it sells is the thing collaboration has never had: a shared memory that can't lie — so teams, creators, and agent networks pay to work inside the one place whose history is provable and whose next move is earned.

## Architecture
Workspace A
  Task · Policy · Evaluator · Memory · Self()
        ↓
P2P Workbench B
        ↓
   Experience
        → A


- **Workspace A** — controller. Task setter and evaluator live inside A.
- **P2P State Machine B** — environment that generates experience. Not a customer.
- **Ledger** — experience memory `E`, not only an audit trail.
- **z** — compressed state / next-action signal.
- **Self()** — policy revision from `M ⊕ E`.
- **P()** — prediction from retrieved similar `E`.
- **W()** — world transition `B' = W(B,y)`.
- **e** — `ΔB − hatΔB`.
- **V** — `e²` progress stand-in.
- **Task generator** — next `T` = weakest skill (highest mean `|e|`).

A_t → Task_t → Action_t → B_{t+1} → Measure → E_t → A_{t+1}
A_{t+1} = Self(A_t, M_t ⊕ E_t, B_{t+1})
B_{t+1} = W(B_t, y_t)
T_{t+1} = Task(A_{t+1}, B_{t+1}, z_t)


This is a SIMA-*like* experience loop. It is not SIMA 2. It is not foundation-model weight training. `claimed_self_improving_ai = false`.

Music is the first vertical. Diagnostic Safety Workbench is created from B as evidence state, not as a diagnosis.

## Live

| Path | Role |
|---|---|
| [/](https://shiyan-dap.vercel.app) | Home. Workspace / Marketplace / Playlist. Grok Bot. |
| [/workspace](https://shiyan-dap.vercel.app/workspace) | Execute task. Write E. Next weakest T. |
| [/workbench](https://shiyan-dap.vercel.app/workbench) | P2P B. |
| [/workbench/safety](https://shiyan-dap.vercel.app/workbench/safety) | Diagnostic evidence state. |
| [/architecture](https://shiyan-dap.vercel.app/architecture) | Correspondence table. |
| [/self](https://shiyan-dap.vercel.app/self) | Names. |
| [/api/workspace/experience](https://shiyan-dap.vercel.app/api/workspace/experience) | GET snapshot / POST tick. |
| [/nfts](https://shiyan-dap.vercel.app/nfts) | Music $1 rail. |

## Not yet

Self-improving AI claim, SIMA 2 reproduction, weight training, proven global convergence, independent payer proof, Level 3, $10 billing, diagnostics product, misdiagnosis elimination, device claim.


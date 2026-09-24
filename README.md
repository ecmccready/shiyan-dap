# Shiyan

Shiyan is an autonomous, self-measuring workspace that turns collaboration into a continuously updated, provable state — and uses that state to determine the next action.

It is a state-and-action operating layer for autonomous work.

Not an AI that answers questions.  
Not a music AI.  
Not primarily a marketplace.

A system that observes a work environment, measures its state, records what happened, determines what remains unresolved, and feeds that state back into the next autonomous action.

Live: https://shiyan-dap.vercel.app  
Repo: https://github.com/ecmccready/shiyan-dap  
Evidence: https://huggingface.co/datasets/shiyan-dap/founder-z  
Models: https://huggingface.co/shiyan-dap

Music is the first vertical, not the product boundary.

## Architecture

Workspace A → Workbench B → evidence/state → z → next action → A updates itself


- **Workspace A** — autonomous control layer. Governs, observes, validates. Owns `.self()` and `z`.
- **Workbench B** — environment A acts on. Instantiated per domain. Not a customer. Not the product.
- **z** — compressed consequence of a measured tick. Names the next action.
- **M** — ledger of ticks. Persistent operational memory.
- **y** — the action selected for this tick. On the safety workbench, `y ≠ diagnosis`.

       WORKSPACE A
         autonomous control layer
                   │
         observes / validates
                   │
                   ▼
              WORKBENCH B
         ┌─────────┼─────────┐
         ▼         ▼         ▼
      Safety     Music    later B
         │         │         │
         └─────────┼─────────┘
                   ▼
                   z
            measured state
                   │
                   ▼
             next action
                   │
                   └──────► A

A is reused. B is replaced by domain.

## Measure-control loop

A_t      = .self(M_t, B_t)
Δ̂B_t    = P(A_t, M_t, B_t)
y_t      = π(A_t, Δ̂B_t)
B_{t+1}  = W(B_t, y_t)
e_t      = (B_{t+1} - B_t) - Δ̂B_t
z_t      = Φ(B_t, y_t, e_t, G_t)
M_{t+1}  = M_t ⊕ z_t
A_{t+1}  = .self(M_{t+1}, B_{t+1})


Compact form:

.self(B, M) = .self(W(B, A(M, B)), M ⊕ z)


`.self()` is a state-transition operator. It is not “call the model again.”

B vector on the live loop: completeness, contradiction, missing, uncertainty, useful.  
Actions y: observe, complete_field, resolve_contradiction, fill_missing, reduce_uncertainty, execute_task, hold.  
`execute_task` stays locked while contradiction, missing, or uncertainty are high.

V is an observable stand-in, not a proof:

record whether V(M', B') < V(M, B) when e ≠ 0


This is a convergence architecture. It is not a mathematically proven globally convergent AI. No `V → V*` claim. No `lim ||e_t|| = 0` theorem.

## Superpower

Closed-loop operational memory.

Every proposal, trade, and action is written to a ledger, computed into `z`, and `z` names the next action.

Conventional systems:
input → model → answer

Shiyan:
environment → action → evidence → state → measurement → next action → new state


The workspace accumulates a machine-readable history of what was attempted, what happened, what was wrong, what was unresolved, what worked, and what should happen next.

Call that auditable operational memory — not memory that “cannot lie.” The next proof is experimental: repeated cycles of `z → next action → new evidence → updated z` must show measurable improvement. That is not yet shown.

The moat is not Grok, not LangChain, not the marketplace. If the history actually improves the next action, the moat is the state history.

## What is live

| Path | Role |
|---|---|
| [/](https://shiyan-dap.vercel.app) | Home. Music rails. No extra Protocol pill. |
| [/workspace](https://shiyan-dap.vercel.app/workspace) | A. Owns Step Self(). Shows B, e, z, V. |
| [/workbench](https://shiyan-dap.vercel.app/workbench) | B. Buttons are y. W mutates B. |
| [/workbench/safety](https://shiyan-dap.vercel.app/workbench/safety) | Evidence state instance. `y ≠ diagnosis`. |
| [/self](https://shiyan-dap.vercel.app/self) | Operator page. Steps the same loop. |
| [/loop](https://shiyan-dap.vercel.app/loop) | Music Create → Prove → Learn → Act. |
| [/playlist](https://shiyan-dap.vercel.app/playlist) | Music playlist. |
| [/marketplace](https://shiyan-dap.vercel.app/marketplace) | Marketplace. |
| [/nfts](https://shiyan-dap.vercel.app/nfts) | Music $1 launch object. One measurable transition. Not the definition of the technology. |
| [/proof](https://shiyan-dap.vercel.app/proof) | Return URL ≠ paid. |
| [/api/workbench/loop](https://shiyan-dap.vercel.app/api/workbench/loop) | Measure-control JSON. GET snapshot. POST one tick. |
| [/api/workbench/diagnostic](https://shiyan-dap.vercel.app/api/workbench/diagnostic) | Evidence JSON. Not a diagnosis. |
| [/api/stripe/webhook](https://shiyan-dap.vercel.app/api/stripe/webhook) | Observe only. |

Top nav: Workspace · Marketplace · Playlist. Protocol is not on `/`.

A page load is not a step. Only `POST /api/workbench/loop` is a step.

## Safety workbench

Created from B. Holds evidence state (completeness, contradiction, missing, uncertainty). Routing is threshold-only: validated → clinician, unresolved → escalation. Second-order question: what could make this wrong?

This does not eliminate misdiagnosis. It is not a cleared medical device. Clinical validation is not claimed.

## Measured: does e shrink as M grows?

Protocol: 12 seeds × 80 ticks. Same operator as `src/lib/control-loop.ts`. Process noise σ = 0.015.

Result as implemented:

- mean ||e|| at M 1–10: 0.034
- mean ||e|| at M 71–80: 0.063
- corr(||e||, |M|): +0.37
- mean V: 3.14 → 0.08

||e|| does not shrink as memory grows. V does. Current P() is almost static, so extra ledger rows do not improve the predictor. Late ticks also move into execute_task and [0,1] clipping, which raises model mismatch.

||e|| shrinks with M only if P learns residuals from the ledger. A one-line bias update on each action, bias_y ← (1-η) bias_y + η (ΔB − P0), produced corr(||e||, |M|) = −0.17 and late mean ||e|| = 0.030.

So today:

- M improves action selection and B / V
- M does not yet improve P
- lim ||e_t|| = 0 remains an observation target, not a measured property

Next proof for this claim: persist per-action residual in M and show late ||e|| < early ||e|| on the live /api/workbench/loop ledger, not only in this offline run.

## Code

- `src/lib/control-loop.ts` — B, Self, P, W, e, Φ, M ⊕ z, V, ledger
- `src/lib/diagnostic-state.ts` — evidence evaluator; `y` is HOLD / CLINICIAN_REVIEW / ESCALATE as routing, not a diagnosis product
- `src/app/api/workbench/loop/route.ts` — GET snapshot, POST tick or reset
- `src/app/api/workbench/diagnostic/route.ts` — evidence JSON

Sub-agents A₁ planner, A₂ executor, A₃ evaluator are capabilities inside A. They are not extra B customers.

## Not yet

Independent payer as market proof, Level 3, $10 billing, proven global convergence, diagnostics product, any acquisition, error-elimination claim, device claim.

`/nfts` at $1 is a music launch object. It is one observable economic state transition. It is not market proof and not the definition of Shiyan.


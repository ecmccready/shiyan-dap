# Shiyan DAP

Live: https://shiyan-dap.vercel.app  
Repo: https://github.com/ecmccready/shiyan-dap

Workspace A is a **model-portable autonomous controller**.  
Workbench B is an **environment**, not a customer.  
Music is the first vertical. There is no Buy as B rail.

Grok fast, Hy4 deep, and Grok Bot orchestrate A.  
This is **not SIMA 2, not AGI, not a clinical product**.

## What it is

A Workspace that:

1. Uses Workbenches as environments
2. Turns actions `y` into measurable experience
3. Maintains state `z`
4. Predicts outcomes
5. Measures error
6. Uses `Self()` to select or revise the next action

Portable means: keep A, `Self()`, and memory `M`. Swap the workbench `W` and the measurement of `z`. Carry `M` to the next host.

## Live rails

| Surface | Role |
|---|---|
| `/` | Home. Workspace A · Marketplace · Playlist · Songs |
| `/workspace` | Controller A. Opens Workbench B. Reads `z` |
| `/workbench` | Environment B. Instantiated per domain |
| `/workbench/safety` | Evidence gate. HOLD / CLINICIAN_REVIEW / ESCALATE. Not a diagnosis |
| `/single` | Songs in cluster A |
| `/nfts` | Prove rail |
| `/playlist` `/marketplace` `/upload` `/bot` | Music rails and Grok Bot |

## Orchestration

| Path | Job |
|---|---|
| **Grok fast** | Name a cheap `y` from current `z` and last `M` |
| **Hy4 deep** | Revise `y` when error is large or the plant is unfamiliar |
| **Grok Bot** | Orchestrate. Choose fast or deep, write the action onto B, return `z` |

operator or lock
        |
        v
   Grok Bot
    /        
Grok fast   Hy4 deep
    \        /
        y
        v
   Workspace A  --Self(M ⊕ z)--> y'
        |
        v
   Workbench B  --W(B,y)--> B' --measure--> z


Bot is the switch. Fast is the default policy. Deep is the revision path.  
`Self()` is the lock: after explore, `operator_chose_action = false`.

## Loop

retrieve M
    → predict ŷ / expected z
    → act y on Workbench B
    → measure z from B'
    → error e = z − predicted
    → Self(M ⊕ z) selects or revises y'

Experience is one ledger row per step:

```ts
{ t, y, predicted, z, e, V, path: "fast" | "deep" | "bot", operator_chose_action }

FormulasA→yB′=W(B,y)→zSelf(M⊕z)→y′A \xrightarrow{y} B' = W(B, y) \xrightarrow{z} \mathrm{Self}(M \oplus z) \xrightarrow{y'}A \xrightarrow{y} B' = W(B, y) \xrightarrow{z} \mathrm{Self}(M \oplus z) \xrightarrow{y'}
z^t=P(Mt−1,yt)\hat{z}_{t} = P(M_{t-1}, y_t)\hat{z}_{t} = P(M_{t-1}, y_t)
zt=measure(Bt′)z_t = \mathrm{measure}(B'_t)z_t = \mathrm{measure}(B'_t)
et=zt−z^te_t = z_t - \hat{z}_te_t = z_t - \hat{z}_t
Vt={∣zt∣scalar plant∥zt∥quality plantV_t =
\begin{cases}
|z_t| & \text{scalar plant} \\
\|z_t\| & \text{quality plant}
\end{cases}V_t =
\begin{cases}
|z_t| & \text{scalar plant} \\
\|z_t\| & \text{quality plant}
\end{cases}
yt+1=Self(Mt⊕zt,et)y_{t+1} = \mathrm{Self}(M_t \oplus z_t, e_t)y_{t+1} = \mathrm{Self}(M_t \oplus z_t, e_t)
autonomous(t)  ⟺  operator_chose_action(t)=false\mathrm{autonomous}(t) \iff \mathrm{operator\_chose\_action}(t) = \mathrm{false}\mathrm{autonomous}(t) \iff \mathrm{operator\_chose\_action}(t) = \mathrm{false}
Symbol
Meaning
(A)
Workspace. Task, policy, predictor (P), evaluator, memory (M), Self()
(y)
Action written onto a workbench
(B)
Workbench / environment. Not a buyer
(W)
Plant map. Swap per domain
(B')
Environment after the action
z^\hat{z}\hat{z}

Predicted measurement
(z)
Measured state / residual / defects
(e)
Prediction error
(V)
Value attained this step
(M)
Portable memory. Ledger of experience
Self\mathrm{Self}\mathrm{Self}

Score (z) and (e), update (M), lock or revise (y')

Scalar proof plant:B0=100,W(B,y)=B+y,y∈{+10,+5,−5,−10}B_0 = 100,\quad W(B, y) = B + y,\quad y \in \{+10,+5,-5,-10\}B_0 = 100,\quad W(B, y) = B + y,\quad y \in \{+10,+5,-5,-10\}
z=∣B′∣,V=zz = |B'|,\quad V = zz = |B'|,\quad V = z
Quality evidence plant (not a diagnosis):B=(completeness,  contradiction,  missing,  uncertainty,  useful)B = (\mathrm{completeness},\;\mathrm{contradiction},\;\mathrm{missing},\;\mathrm{uncertainty},\;\mathrm{useful})B = (\mathrm{completeness},\;\mathrm{contradiction},\;\mathrm{missing},\;\mathrm{uncertainty},\;\mathrm{useful})
z=defects(B′),V=∥z∥z = \mathrm{defects}(B'),\quad V = \|z\|z = \mathrm{defects}(B'),\quad V = \|z\|
Do not claim global convergence. APIs return claimed_global_convergence: false.Model-portable WorkspaceKeep:Workspace A
Self()
Memory M (the ledger of y, z^\hat{z}\hat{z}
, z, e, V)
Grok fast / Hy4 deep / Grok Bot as the action oracles

Swap:Workbench W (music, safety evidence, later weight / speed / 3-D map)
measure() that produces z
Predictor (P) if the new plant needs a different forecast

To move hosts: ship A + M. The next workbench can be empty. A writes new z as soon as W exists.Deeming rulesClaim
Allowed when
A acted on B
Ledger row: y applied, z recorded
Experience written
Row contains predicted, z, e
Autonomous step
operator_chose_action === false
Value attained
V_t stored on that row
Fast vs deep
path is "fast" or "deep"
Bot orchestrated
path === "bot" or the /bot rail named y
Better than frozen policy
Compare ∑V\sum V\sum V
 on the same plant, same horizon
Safety signal
/workbench/safety only. Not a diagnosis
SIMA 2 / AGI / clinical
Never

ScopeIn:Model-portable Workspace A
Workbenches as environments
Predict → act → measure → error → Self() → next y
Music as first vertical
Evidence gate on the workbench
Grok fast, Hy4 deep, Grok Bot as orchestrators

Out:SIMA 2
AGI
Clinical diagnosis or treatment
Buy as B / potential-customer pipeline


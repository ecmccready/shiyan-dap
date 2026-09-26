# Shiyan

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


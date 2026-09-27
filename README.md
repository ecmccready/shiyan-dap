# Shiyan

Live: https://shiyan-dap.vercel.app

Repo: https://github.com/ecmccready/shiyan-dap

Workspace A is a **model-portable autonomous controller**.

Workbench B can still measure state `z`.

**You Buy as B.** Workspace B is a **potential customer in scope**, not an environment-only out-of-scope role.

Music is the first vertical, not the product boundary.

Grok fast, Hy4 deep, and Grok Bot orchestrate A.

This is **not SIMA 2, not AGI, and not unsupervised clinical diagnosis or treatment**.

## Commercial intent

This repository states intent to commercially implement:

1. **Healthcare** pathways — operations and agentic workflows with a human gate. Not unsupervised diagnosis or treatment.
2. **Enterprise agentic workflows** — plan → tool calls → human approval → audit.
3. **General-purpose software-as-a-service (SaaS)** pathways — tenant, buyer workspace, paid rail.

OnRail folders in this repo:

| Path | Role | Status |
| --- | --- | --- |
| `onrail/platform` | Workspace A / vendor environment | Internal |
| `onrail/customer-b` | Workspace B / potential customer | **IN SCOPE** |

Buy as B must stay in scope versus out. B is a buyer identity, not a disposable second environment.

## What it is

A Workspace that:

1. Uses workbenches as measurable environments
2. Turns actions `y` into experience
3. Maintains state `z`
4. Predicts outcomes
5. Measures error
6. Uses `Self()` to select or revise the next action
7. Sells to B as a potential customer on healthcare, enterprise agentic, and general SaaS pathways

Portable means: keep A, `Self()`, and memory `M`. Swap the workbench `W` and the measurement of `z`. Carry `M` to the next host. Keep B in scope as the buyer.

## Live rails

| Surface | Role |
| --- | --- |
| / | Home. Workspace A · Marketplace · Playlist · Songs |
| /workspace | Controller A. Opens workbench measurement. Reads `z` |
| /workbench | Measurable environment instantiated per domain |
| /workbench/safety | Evidence gate. HOLD / CLINICIAN_REVIEW / ESCALATE. Not a diagnosis |
| /offer | Buy as B rail. Potential customer in scope |
| /single | Songs in cluster A |
| /nfts | Prove rail |
| /playlist /marketplace /upload /bot | Music rails and Grok Bot |

## Orchestration

| Path | Job |
| --- | --- |
| **Grok fast** | Name a cheap `y` from current `z` and last `M` |
| **Hy4 deep** | Revise `y` when error is large or the plant is unfamiliar |
| **Grok Bot** | Orchestrate. Choose fast or deep, write the action, return `z` |

Bot is the switch. Fast is the default policy. Deep is the revision path.
`Self()` is the lock: after explore, `operator_chose_action = false`.

## Loop

retrieve M
→ predict ŷ / expected z
→ act y
→ measure z
→ error e = z − predicted
→ Self(M ⊕ z) selects or revises y'


## Scope

**In**

- Model-portable Workspace A
- Workbenches as measurable environments
- Predict → act → measure → error → Self() → next `y`
- Music as first vertical
- Evidence gate on the workbench
- Grok fast, Hy4 deep, Grok Bot as orchestrators
- Buy as B / potential-customer pipeline
- Healthcare commercial pathways
- Enterprise agentic workflows
- General-purpose SaaS pathways

**Out**

- SIMA 2
- AGI
- Unsupervised clinical diagnosis or treatment
- Treating Workspace B as environment-only / out of buyer scope


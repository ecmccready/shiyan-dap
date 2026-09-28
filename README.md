# Shiyan

Live: https://shiyan-dap.vercel.app
Repo: https://github.com/ecmccready/shiyan-dap

One closed loop. Not three products.

```
z_t --Self() in A--> y_t --W(B,y)--> B'_{t+1}
     measure z_{t+1}, e_t --M--> z-next
```

- **A** — controller: Task, Policy, Evaluator, Memory, Self(). Names `y`.
- **B** — environment: safety reference pack (misdiagnosis-process cases as experience). Not a customer. Not a clinician.
- **z** — measured `|B'|` after the transition. Not an LLM opinion.
- **e** — error vs the reference label / second-order check. This is what can list on the marketplace.

Intelligence is the measured reduction of `e` on B.

Grok fast, Hy4 deep, and Grok Bot are interchangeable orchestrators **inside A**. They only name `y`. Models do not sit outside the loop.

Music is the first vertical rail (`/nfts`). Diagnostic safety is the first measurable plant (`/workbench/safety`). Domain = safety opens that plant.

This is **not SIMA 2, not AGI, and not unsupervised clinical diagnosis or treatment**.

## Live rails

| Surface | Role in the one loop |
|---|---|
| `/` | The loop. A acts, B transitions, z is measured. |
| `/loop` | Runnable plant. Step e down. |
| `/workspace` | A names y. Drop-in namers. |
| `/workbench` | B runs W(B,y). Experience generator. |
| `/workbench/safety` | Safety reference pack. HOLD / CLINICIAN_REVIEW / ESCALATE. |
| `/architecture` | Spec for the triad. |
| `/marketplace` | e listings + music ledger. |
| `/nfts` | Music prove rail. |
| `/bot` | Grok Bot as a namer of y. |

## What it is

A Workspace that:

1. Uses one Workbench as the environment
2. Turns actions `y` into measurable experience
3. Maintains state `z`
4. Predicts outcomes
5. Measures error `e` against a reference
6. Uses `Self()` to select or revise the next action
7. Lists `e` when a second-order check exists

Portable means: keep A, `Self()`, and memory `M`. Swap the workbench `W` and the measurement of `z`. Carry `M` to the next host.

## Status

Scaffold only. No production PHI. No live claims. No unsupervised clinical decisions. Evidence gate only — not a diagnosis, not a device.

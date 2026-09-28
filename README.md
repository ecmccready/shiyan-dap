# Shiyan

Live: https://shiyan-dap.vercel.app  
Repo: https://github.com/ecmccready/shiyan-dap

**Generative Transform Protocol (GTP)** is the autonomous agentic AI controller in this repo.  
**Generative Pretrained Transform (GPT)** is a portable model seat inside that controller. It names `y`. It does not name `z`. It does not sit outside the loop.

One closed loop. Not three products.


- **A** — controller: Task, Policy, Evaluator, Memory, Self(). Names `y`.
- **B** — environment: safety reference pack (misdiagnosis-process cases as experience). Not a customer. Not a clinician.
- **z** — measured `|B'|` after the transition. Not an LLM opinion.
- **e** — error vs the reference label / second-order check. This is what can list on the marketplace.

Intelligence is the measured reduction of `e` on B.

Grok fast, Hy4 deep, and Grok Bot are interchangeable orchestrators **inside A**. They only name `y`. Models do not sit outside the loop.

Music is the first vertical rail (`/nfts`). Diagnostic safety is the first measurable plant (`/workbench/safety`). Domain = safety opens that plant.

---

## Formula

GTP closes that step. A GPT-class namer may propose `y`. The controller accepts or revises it. `W` and `μ` are not the model.

GPT / Grok / Hy4 / Bot  →  names y
            ↓
     GTP controller A   →  Self(), M
            ↓
          W(B, y)       →  plant
            ↓
         μ(B')          →  z, e  →  M
         
`computeB()` names `B`. `Self()` selects the next `y` from `z` and `M`. The model does not invent `B` and does not name `z`.

Portable means: keep A, `Self()`, and memory `M`. Swap the workbench `W` and the measurement of `z`. Swap the GPT. Carry `M` to the next host.

---

## Live rails

| Surface | Role in the one loop |
|---|---|
| `/` | The loop. A acts, B transitions, z is measured. |
| `/loop` | Runnable plant. Step e down. |
| `/workspace` | A names y. Drop-in namers. |
| `/workbench` | B runs W(B,y). Experience generator. |
| `/workbench/safety` | Safety reference pack. HOLD / CLINICIAN_REVIEW / ESCALATE. |
| `/architecture` | Spec for the triad. GTP controller. GPT namer. |
| `/protocol` | Operator view of slice_v6 tools. |
| `/marketplace` | e listings + music ledger. |
| `/nfts` | Music prove rail. |
| `/bot` | Grok Bot as a namer of y. |

---

## What it is

A Workspace that:

1. Speaks GTP as the controller protocol
2. Hosts a GPT-class model only as a namer of `y`
3. Uses one Workbench as the environment
4. Turns actions `y` into measurable experience
5. Maintains state `z`
6. Predicts outcomes
7. Measures error `e` against a reference
8. Uses `Self()` to select or revise the next action
9. Lists `e` when a second-order check exists

---

## Status

Demonstrate that the same A architecture can enter a materially different B as a P2P real patient misdiagnostic data and understand its measurable state/action space, operate autonomously, accumulate experience, and improve its action selection without hard-coding the solution for that particular B, proof of autonomous control into evidence for a general-purpose agent architecture.

This scaffold does not ingest production PHI, does not emit a diagnosis, and does not treat. Gates remain HOLD / CLINICIAN_REVIEW / ESCALATE. Evidence gate only — not a device.

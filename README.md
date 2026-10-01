# Aethel Node

Sovereign multi-model orchestration and multi-domain workspace infrastructure (formerly Shiyan-DAP).

Live: https://shiyan-dap.vercel.app
Repo: https://github.com/ecmccready/shiyan-dap

Aethel Node is commercial development on what Shiyan already built.
The repo name is still `shiyan-dap`.
The product name is Aethel Node.
The engine did not get replaced.

Keep what works. Add the next commercial plant. Do not reset traction.

## What this is

Customers do not buy "Shiyan DAP," an AI, or a state machine.

They buy a system that repeatedly takes an action, observes the result, measures the error against a reference, and uses that experience to choose the next action.

- Sales: turn operational experience into the next best action.
- Technical: a model-portable closed-loop execution system where intelligence is measured by reduction of error, not by model output alone.
- Unit they operate: a **Run** on **Workbench B**. Metric: **Δe**.

HOME A controller · music vertical · namers of y
   │
   ▼
WORKBENCH B commercial plant · SaaS surface
   Run | Diagnostic | Proof | Audit | Experience
   │
   ▼
W(B,y) → measured z → error e → Self() → y' → repeat

Organization → Workspace A → Workbench B → Run → Experience → Marketplace

The proof object, on Safety, is the customer sentence:

I gave A this Workbench. A took this action. B changed this way. The measured result was this. Error changed by this amount. Therefore this experience was created. On the next Run, A used that experience.

## Navigation strategy

Home is A. Workbench is B. That split is the product, not a layout preference.

| Surface | Role | Customer meaning |
|---|---|---|
| `/` Home A | Controller | Goal, task, namer of y. Music is the first vertical. |
| `/workbench` Workbench B | Environment | The SaaS plant. Runs, domains, audit, listed experience. |
| Diagnostic | Plant on B | Validation of y against a reference. Not a header product. |
| Proof | Plant on B | Run → z → e → Δe → experience, and whether the next case used it. Not a header product. |
| Audit | Plant on B | Frozen run + digest when Δe stalls. Human review desk. |
| Marketplace / Playlist / Songs | Kept rails | Assets already listed. Traction stays on the page. |

Diagnostic, Proof, and Audit do not sit next to Home as sibling products.
They open from Workbench B.

Domain select `safety` / `compliance` lands on `/workbench`.
Domain select `music` lands on `/`.

## What was built (and is kept)

Shiyan already shipped the loop. Aethel Node commercializes that loop without rewriting it.

| Built | Role | Where | Status |
|---|---|---|---|
| Closed loop | A acts, B transitions, z is measured, e is scored, Self() names next y | `src/lib/closed-loop.ts` | Protected. Not redesigned. |
| Controller A | Task, policy, evaluator, memory, Self(). Names y. Not a product. | engine | Kept. Self() does not read prior Runs. |
| Environment B | Workbench. W(B,y) produces experience. Not a customer. | `/workbench` | Commercial core |
| Namers of y | Grok fast, Hy4 deep, Grok Bot. Interchangeable. Not the product. | inside A | Kept |
| Music vertical | Home. First commercial rail. | `/` | Live |
| Workbench B | Outcome Engine. Start / step / close a Run. List experience. | `/workbench` | Live |
| Safety pack | Evidence gate. HOLD / CLINICIAN_REVIEW / ESCALATE. | `/workbench/safety` | Live |
| Proof | One B. Case 1, Case 2, Case 3. Cold versus reuse. | `/workbench/proof` | Live. Reuse did not beat cold. |
| Marketplace | Two listed singles + path for listed e / experience | `/marketplace` | Live |
| Playlist / Songs | Shiyan Yishu — First Single, Sleep Terrors — Second Single | `/playlist` `/single` | Live assets |
| Prove rail | NFT / proof path for the same two works | `/nfts` | Kept |
| Commercial wrapper | Run identity, Δe, history. Does not edit the loop. | `src/product/run.ts` | Kept |
| OnRail | Workspace A vendor env + Workspace B buyer scope | `onrail/` | In scope |

Core loop = protected. Commercialization = additive.

## New in this development

Date: 2026-10-01.

- Proof is a plant on Workbench B, at `/workbench/proof`. It is not a new product and not a new vertical.
- The record is readable. Case 1, Incomplete evidence pack: y = `request_independent_check`, z = `0.918`, e `1.561 → 0.165`, Δe `1.396`.
- Case 2, Missing measurements, and Case 3, Provenance gap, finish at Δe `1.183` cold and `1.183` reuse.
- The page states the result: later cases did not beat cold Self(). Do not claim the flywheel.
- The charge control writes an unsettled receipt. It is not a payment. No settled Safety outcome is on record.
- `Self()` remains a one-step search. Experience reuse, where attempted, is a policy outside the loop.

## Assets that stay listed

Do not orphan traction while the engine generalizes.

| Asset | Rail | Why it stays |
|---|---|---|
| Shiyan Yishu — First Single | `/single` `/playlist` `/marketplace` `/nfts` | Founder proof. First listed work. |
| Sleep Terrors — Second Single | `/single` `/playlist` `/marketplace` | Second listed work. Same settlement path. |
| Listed e / experience | `/marketplace` | Validated Δe becomes a reusable asset. Not validated on the Safety proof yet. |

Music is the first vertical, not the product boundary.

## What "model-portable controller" means

A is the controller. A is not a model.

Portable means:

1. Keep A: task, policy, evaluator, memory M, Self().
2. Swap the namer of y (Grok fast / Hy4 deep / Grok Bot / later any GPT-class model).
3. Swap Workbench B (Music, Safety, Compliance, next measurable environment).
4. Keep measuring z and e the same way.
5. Carry M to the next host.

Intelligence is Δe on B, not the paragraph a model writes.
One controller, many environments, many models.
Carrying M is not the same as the next Run improving. The Safety proof is the check.

## Diagnostic validation as a commercial core

Buyers in high-stakes operations do not pay for generated text.
They pay for verified reduction of error.

REFERENCE TRUTH (guidelines / rulesets)
        │
CASE INPUT → CONTROLLER A → WORKBENCH B → z
   (pack)        (namer y)     (simulate)
        │              ▲            │
        └──── SELF() ◄──────────── e , Δe

| Loop variable | Diagnostic meaning |
|---|---|
| y | Hypothesis, test recommendation, or pathway named by A |
| z | Measured output after the pathway is simulated against constraints |
| e | Variance from the reference pack |
| Δe | What a buyer purchases: error narrowed across steps |

| Added plant | Path | Job |
|---|---|---|
| Diagnostic state schema | `src/product/diagnostic.ts` | Structured case + reference framework |
| Deterministic scorer | `src/lib/evaluators/diagnostic-rules.ts` | Spike e when a pathway skips prerequisites |
| Gatekeeper | `src/workbench/safety/gatekeeper.ts` | HOLD / CLINICIAN_REVIEW / ESCALATE / FROZEN + digest |
| Engine hook | `src/lib/engine.ts` | New workbench = schema + error function |
| Review desk | `/audit` | Human-in-the-loop when Δe stalls |
| Proof | `/workbench/proof` | Whether a later case used, and beat, a prior Run |

Safety remains an evidence gate. It is not a diagnostic device.
No production PHI. No unsupervised clinical decision.

## Commercial vector

| Asset | Customer value | Monetization | Evidence |
|---|---|---|---|
| Auditable verification logs | Every y was simulated, z measured, e scored before execution | Per-run / API | Safety proof records y, z, e, Δe. |
| Sovereign engine architecture | Swap models or hosts; keep M | On-prem / enterprise seat | Namers swap. M does not yet change Self(). |
| Verified experience marketplace | Discover or list loop policies that already cut e | Platform fee | Two singles listed. Safety reuse has not cut e below cold. |

Do not commercialize the AI. Commercialize the closed-loop outcome.
Do not list a Safety Δe as verified experience until a later Run beats cold.

## Surfaces

| URL | What the customer sees |
|---|---|
| `/` | Home A. Music vertical. Workbench, Marketplace, Playlist, Songs. |
| `/workbench` | Workbench B. Run plant. Diagnostic, Proof, and Audit open here. |
| `/workbench/safety` | Diagnostic validation plant on B. |
| `/workbench/proof` | Run 001 and later cases. Cold versus reuse. Flywheel refused if tied. |
| `/audit` | Review desk. Frozen digests. |
| `/marketplace` | First Single + Sleep Terrors. Experience can list. |
| `/playlist` | Settlement rail for those two assets. |
| `/single` | Play / Prove for those two assets. |
| `/nfts` | Prove rail. |
| `/loop` | Protected loop runner. |
| `/architecture` | Spec. |

`/workspace` and `/run` redirect into home and Workbench.
They are not separate products.

## How we develop from here

Adjust as we go. Add to what exists. Do not rewrite the loop to announce a new narrative.

1. Keep the loop.
2. Keep the two listed works and their rails.
3. Name the next workbench on B (Node / Music / Safety / Compliance / next).
4. Define the reference that makes e measurable.
5. Run.
6. Freeze and audit when Δe stalls.
7. List validated experience when a second-order check exists.
8. Claim reuse only when a later Run beats cold on steps, unsafe gates, or final e.
9. Charge only after that comparison wins. An unsettled receipt is not revenue.

Momentum is the live site, the two assets, the Run primitive, and the same A entering more than one B.
Consolidation means fewer top-level products and a stronger Workbench B.
The next milestone is one demonstration: Run → Experience → Run, with Δe = e2 − e1. Negative means better.

## Unicorn Development Status

Aethel Node becomes potentially enormous if it can become the infrastructure layer through which organizations turn real-world actions and outcomes into reusable machine experience across many Workbench environments.

That sentence is the thesis. It is not a measurement.

| Claim | Status on 2026-10-01 |
|---|---|
| A acts on B, produces z, calculates e/Δe | Shown on `/workbench/proof`. Case 1 Δe `1.396`. |
| The experience improves the next action | Not shown. Case 2 and Case 3 reuse Δe `1.183` = cold `1.183`. |
| Customers pay for the outcome | Not shown. Receipt is unsettled. |
| The same engine works across multiple Bs without rebuilding A | Music and Safety use the same A. Compliance is named, not a second built B. |
| Experience compounds | Not shown. |
| Customers or partners create new B environments | Not shown. Both live Bs were built here. |
| Revenue grows faster than engineering effort | Not shown. |

Commercial development is underway on the Shiyan engine.
The first customer-facing primitive is a Run on Workbench B.
Diagnostic validation and the Safety proof are plants on that same workbench.
The smaller proposition still to prove:

A acts on B → B produces measurable z → Δe → experience → better next action → customer value

Repo: https://github.com/ecmccready/shiyan-dap
Live: https://shiyan-dap.vercel.app
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

Customers do not buy “Shiyan DAP,” an AI, or a state machine.

They buy a system that repeatedly takes an action, observes the result, measures the error against a reference, and uses that experience to choose the next action.

- Sales: turn operational experience into the next best action.
- Technical: a model-portable closed-loop execution system where intelligence is measured by reduction of error, not by model output alone.
- Unit they operate: a **Run** on **Workbench B**. Metric: **Δe**.

HOME A controller · music vertical · namers of y │ ▼ WORKBENCH B commercial plant · SaaS surface Run | Diagnostic | Audit | Experience │ ▼ W(B,y) → measured z → error e → Self() → y' → repeat

Organization → Workspace A → Workbench B → Run → Experience → Marketplace

## Navigation strategy

Home is A. Workbench is B. That split is the product, not a layout preference.

| Surface | Role | Customer meaning |
|---|---|---|
| `/` Home A | Controller | Goal, task, namer of y. Music is the first vertical. |
| `/workbench` Workbench B | Environment | The SaaS plant. Runs, domains, audit, listed experience. |
| Diagnostic | Plant on B | Validation of y against a reference. Not a header product. |
| Audit | Plant on B | Frozen run + digest when Δe stalls. Human review desk. |
| Marketplace / Playlist / Songs | Kept rails | Assets already listed. Traction stays on the page. |

Diagnostic and Audit do not sit next to Home as sibling products.
They open from Workbench B.

Domain select `safety` / `compliance` lands on `/workbench`.
Domain select `music` lands on `/`.

## What was built (and is kept)

Shiyan already shipped the loop. Aethel Node commercializes that loop without rewriting it.

| Built | Role | Where | Status |
|---|---|---|---|
| Closed loop | A acts, B transitions, z is measured, e is scored, Self() names next y | `src/lib/closed-loop.ts` | Protected |
| Controller A | Task, policy, evaluator, memory, Self(). Names y. Not a product. | engine | Kept |
| Environment B | Workbench. W(B,y) produces experience. Not a customer. | `/workbench` | Commercial core |
| Namers of y | Grok fast, Hy4 deep, Grok Bot. Interchangeable. Not the product. | inside A | Kept |
| Music vertical | Home. First commercial rail. | `/` | Live |
| Workbench B | Outcome Engine. Start / step / close a Run. List experience. | `/workbench` | Live |
| Safety pack | Evidence gate. HOLD / CLINICIAN_REVIEW / ESCALATE. | `/workbench/safety` | Live, expanding |
| Marketplace | Two listed singles + path for listed e / experience | `/marketplace` | Live |
| Playlist / Songs | Shiyan Yishu — First Single, Sleep Terrors — Second Single | `/playlist` `/single` | Live assets |
| Prove rail | NFT / proof path for the same two works | `/nfts` | Kept |
| Commercial wrapper | Run identity, Δe, history. Does not edit the loop. | `src/product/run.ts` | Kept |
| OnRail | Workspace A vendor env + Workspace B buyer scope | `onrail/` | In scope |

Core loop = protected. Commercialization = additive.

## Assets that stay listed

Do not orphan traction while the engine generalizes.

| Asset | Rail | Why it stays |
|---|---|---|
| Shiyan Yishu — First Single | `/single` `/playlist` `/marketplace` `/nfts` | Founder proof. First listed work. |
| Sleep Terrors — Second Single | `/single` `/playlist` `/marketplace` | Second listed work. Same settlement path. |
| Listed e / experience | `/marketplace` | Validated Δe becomes a reusable asset. |

Music is the first vertical, not the product boundary.

## What “model-portable controller” means

A is the controller. A is not a model.

Portable means:

1. Keep A: task, policy, evaluator, memory M, Self().
2. Swap the namer of y (Grok fast / Hy4 deep / Grok Bot / later any GPT-class model).
3. Swap Workbench B (Music, Safety, Compliance, next measurable environment).
4. Keep measuring z and e the same way.
5. Carry M to the next host.

Intelligence is Δe on B, not the paragraph a model writes.
One controller, many environments, many models.

## Diagnostic validation as a commercial core

Buyers in high-stakes operations do not pay for generated text.
They pay for verified reduction of error.

REFERENCE TRUTH (guidelines / rulesets) │ CASE INPUT → CONTROLLER A → WORKBENCH B → z (pack) (namer y) (simulate) │ ▲ ▼ └──── SELF() ◄──────────── e , Δe

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

Safety remains an evidence gate. It is not a diagnostic device.
No production PHI. No unsupervised clinical decision.

## Commercial vector

| Asset | Customer value | Monetization |
|---|---|---|
| Auditable verification logs | Every y was simulated, z measured, e scored before execution | Per-run / API |
| Sovereign engine architecture | Swap models or hosts; keep M | On-prem / enterprise seat |
| Verified experience marketplace | Discover or list loop policies that already cut e | Platform fee |

Do not commercialize the AI. Commercialize the closed-loop outcome.

## Surfaces

| URL | What the customer sees |
|---|---|
| `/` | Home A. Music vertical. Workbench, Marketplace, Playlist, Songs. |
| `/workbench` | Workbench B. Run plant. Diagnostic and Audit open here. |
| `/workbench/safety` | Diagnostic validation plant on B. |
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

Momentum is the live site, the two assets, the Run primitive, and the same A entering more than one B.
Consolidation means fewer top-level products and a stronger Workbench B.

## Status

Commercial development is underway on the Shiyan engine.
The first customer-facing primitive is a Run on Workbench B.
Diagnostic validation is the next commercial plant on that same workbench.

Over coming updates, the codebase continues from a personalized integration workspace toward a clean, decoupled engine for operators who need sovereignty over data routing, model choice, and memory M.

Repo: https://github.com/ecmccready/shiyan-dap  
Live: https://shiyan-dap.vercel.app


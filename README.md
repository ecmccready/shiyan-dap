# Aethel Node

Sovereign multi-model orchestration and multi-domain workspace infrastructure (formerly Shiyan-DAP).

Live: https://shiyan-dap.vercel.app  
Repo: https://github.com/ecmccready/shiyan-dap

Aethel Node is commercial development on what Shiyan already built. The repo name is still `shiyan-dap`. The product name is Aethel Node. The engine did not get replaced.

## What this is

Customers do not buy “Shiyan DAP,” an AI, or a state machine.

They buy a system that repeatedly takes an action, observes the result, measures the error against a reference, and uses that experience to choose the next action.

- Sales: Turn operational experience into the next best action.
- Technical: A model-portable closed-loop execution system where intelligence is measured by reduction of error, not by model output alone.
- Unit they operate: a **Run** on **Workbench B**. Metric: **Δe**.
CUSTOMER │ ▼ Aethel Node home (Music vertical) │ ▼ WORKBENCH B environment / Outcome Engine │ y ▼ W(B,y) → measured z → error e → Self() → y' → repeat

Organization → Workbench → Run → Experience → Marketplace


## What was built (and is kept)

Shiyan already shipped the loop. Aethel Node commercializes that loop without rewriting it.

| Built | Role | Where |
|---|---|---|
| Closed loop | A acts, B transitions, z is measured, e is scored, Self() names next y | `src/lib/closed-loop.ts` |
| Controller A | Task, policy, evaluator, memory, Self(). Names y. Not a product. | engine |
| Environment B | Workbench. W(B,y) produces experience. Not a customer. | `/workbench` |
| Namers of y | Grok fast, Hy4 deep, Grok Bot. Interchangeable. Not the product. | inside A |
| Music vertical | Home. First commercial rail. | `/` |
| Workbench B | Outcome Engine. Start / step / close a Run. List experience. | `/workbench` |
| Safety pack | Second environment. Evidence gate only. HOLD / CLINICIAN_REVIEW / ESCALATE. | `/workbench/safety` |
| Marketplace | Two listed singles + path for listed e / experience | `/marketplace` |
| Playlist / Songs | Same two assets: Shiyan Yishu — First Single, Sleep Terrors — Second Single | `/playlist` `/single` |
| Commercial wrapper | Run identity, Δe, history. Does not edit the loop. | `src/product/run.ts` |

Core loop = protected. Commercialization = additive.

## What “model-portable controller” means

A is the controller. A is not a model.

Portable means:

1. Keep A: task, policy, evaluator, memory M, Self().
2. Swap the namer of y (Grok fast / Hy4 deep / Grok Bot / later any GPT-class model).
3. Swap Workbench B (Music, Safety, next measurable environment).
4. Keep measuring z and e the same way.
5. Carry M to the next host.

Intelligence is Δe on B, not the paragraph a model writes. That is why the models stay drop-in namers inside A. That is the benefit of what was already built: one controller, many environments, many models.

## Workbench as commercial product development

Workbench B is the process, not a second app.

A company does not “adopt the AI.” It puts a goal on a workbench, runs W(B,y), reads z, scores e, lets Self() pick the next y, and keeps the Run. That Run is what can be priced, audited, and improved.

Goal → Workbench → Run y₁ → z₁ → e₁ → Self() y₂ → z₂ → e₂ … Outcome Δe = e₀ − e_now


Product development on this stack is therefore:

1. Keep the loop.
2. Name a workbench (Node / Music / Safety / next B).
3. Define the reference that makes e measurable.
4. Run.
5. List validated experience on the marketplace when a second-order check exists.

Safety remains a demonstration that the same A can enter a different B. It is not a diagnostic device. No production PHI. No unsupervised clinical decision.

## Surfaces

| URL | What the customer sees |
|---|---|
| `/` | Aethel Node home. Music vertical. Workbench, Marketplace, Playlist, Songs. |
| `/workbench` | Outcome Engine. Commercial Run on B. |
| `/workbench/safety` | Evidence-gate plant. |
| `/marketplace` | First Single + Sleep Terrors. Experience can list. |
| `/playlist` | Settlement rail for those two assets. |
| `/single` | Play / Prove for those two assets. |
| `/nfts` | Prove rail. |
| `/loop` | Protected loop runner. |
| `/architecture` | Spec. |

`/workspace` and `/run` redirect into home and Workbench. They are not separate products.

## Status

Commercial development is underway on the Shiyan engine. The first customer-facing primitive is a Run on Workbench B.

Over coming updates, the codebase will transition from a personalized integration workspace into a clean, decoupled engine designed for independent developers who demand absolute technical sovereignty.

Do not commercialize the AI. Commercialize the closed-loop outcome.
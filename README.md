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

The proof object, on Safety, is:

RUN #001 creates experience.
RUN #002 uses #001.
Better only if the later run is shorter, safer, or lower-error.

## Navigation strategy

Home is A. Workbench is B. That split is the product, not a layout preference.

| Surface | Role | Customer meaning |
|---|---|---|
| `/` Home A | Controller | Goal, task, namer of y. Music is the first vertical. |
| `/workbench` Workbench B | Environment | The SaaS plant. Runs, domains, audit, listed experience. |
| Diagnostic | Plant on B | Validation of y against a reference. Not a header product. |
| Proof | Plant on B | Run → Experience → Run. Not a header product. |
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
| Proof | Run 001 → Run 002 / 003. Cold versus reuse. | `/workbench/proof` | Live. `6e66236`. |
| Marketplace | Two listed singles + path for listed e / experience | `/marketplace` | Live |
| Playlist / Songs | Shiyan Yishu — First Single, Sleep Terrors — Second Single | `/playlist` `/single` | Live assets |
| Prove rail | NFT / proof path for the same two works | `/nfts` | Kept |
| Commercial wrapper | Run identity, Δe, history. Does not edit the loop. | `src/product/run.ts` | Kept |
| OnRail | Workspace A vendor env + Workspace B buyer scope | `onrail/` | In scope |

Core loop = protected. Commercialization = additive.

## New in this development

Date: 2026-10-01. Production deploy `6e66236` is Ready.

- `/workbench/proof` is the demonstration. Heading: Run → Experience → Run.
- Run #001, Incomplete evidence pack: `request_independent_check → fill_missing → fill_missing → observe`. Error `1.561 → 0.165`. Experience created: YES.
- Run #002 and Run #003 use `#001`. First action changes to `fill_missing → request_independent_check`. Error `1.399 → 0.216`.
- Score against cold: 2 steps and 0 ESCALATE, versus 3 steps and 1 ESCALATE. The page says Better.
- Δe against the cold final error is `0`. The path is shorter and safer. The final error did not fall.
- Reuse is a policy outside the loop. `Self()` was not edited.
- No settled payment. An unsettled receipt is not revenue.

## Assets that stay listed

Do not orphan traction while the engine generalizes.

| Asset | Rail | Why it stays |
|---|---|---|
| Shiyan Yishu — First Single | `/single` `/playlist` `/marketplace` `/nfts` | Founder proof. First listed work. |
| Sleep Terrors — Second Single | `/single` `/playlist` `/marketplace` | Second listed work. Same settlement path. |
| Listed e / experience | `/marketplace` | Validated Δe becomes a reusable asset. Safety reuse has not cut final e. |

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
Carrying a prior y is not the same as lowering e. The Safety proof separates those.

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
| Proof | `/workbench/proof` | Whether a later run used a prior run, and on which score it won |

Safety remains an evidence gate. It is not a diagnostic device.
No production PHI. No unsupervised clinical decision.

## Commercial vector

| Asset | Customer value | Monetization | Evidence |
|---|---|---|---|
| Auditable verification logs | Every y was simulated, z measured, e scored before execution | Per-run / API | Proof records y, z, e, steps, gates. |
| Sovereign engine architecture | Swap models or hosts; keep M | On-prem / enterprise seat | Namers swap. Self() does not read M. |
| Verified experience marketplace | Discover or list loop policies that already cut e | Platform fee | Two singles listed. Safety reuse did not cut final e. |

Do not commercialize the AI. Commercialize the closed-loop outcome.
Do not list a Safety Δe as verified experience until a later Run has a lower final e than cold.

## Surfaces

| URL | What the customer sees |
|---|---|
| `/` | Home A. Music vertical. Workbench, Marketplace, Playlist, Songs. |
| `/workbench` | Workbench B. Run plant. Diagnostic, Proof, and Audit open here. |
| `/workbench/safety` | Diagnostic validation plant on B. |
| `/workbench/proof` | Run #001, then #002 and #003. Steps and ESCALATE compared with cold. |
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

Development criteria for the next change:

1. Keep `src/lib/closed-loop.ts` frozen.
2. Keep the two listed works and their rails.
3. A claim is allowed only if `/workbench/proof` shows it.
4. "Used experience" means the later run names `#001` and its first action differs from cold.
5. "Better" means fewer steps, fewer ESCALATE gates, or a lower final e. A tie on final e is not an error win.
6. "Customer value" means a settled payment for that record. An unsettled receipt does not count.
7. No new vertical until this Safety comparison is the page a buyer opens.

## Unicorn Development Status

Aethel Node becomes potentially enormous if it can become the infrastructure layer through which organizations turn real-world actions and outcomes into reusable machine experience across many Workbench environments.

That sentence is the thesis. It is not a measurement.

| Claim | Status on 2026-10-01 |
|---|---|
| A acts on B, produces z, calculates e/Δe | Shown. Run #001, e `1.561 → 0.165`. |
| A later run uses that experience | Shown. Run #002 and #003 say `Experience used: #001`. |
| The later run is better | Shown on path only. 2 steps, 0 ESCALATE, versus 3 steps, 1 ESCALATE. |
| The later run has lower error | Not shown. Δe against cold is `0`. Final e `0.216` either way. |
| Customers pay for the outcome | Not shown. |
| The same engine works across multiple Bs without rebuilding A | Music and Safety use the same A. Compliance is named, not built. |
| Experience compounds across many workbenches | Not shown. One B. |
| Customers or partners create new B environments | Not shown. |
| Revenue grows faster than engineering effort | Not shown. |

Commercial development is underway on the Shiyan engine.
The first customer-facing primitive is a Run on Workbench B.
The smaller proposition still open:

A acts on B → B produces measurable z → experience → better next action → lower e → customer value

The middle of that line is now visible. The last two terms are not.

Repo: https://github.com/ecmccready/shiyan-dap
Live: https://shiyan-dap.vercel.app

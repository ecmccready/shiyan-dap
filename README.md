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

RUN cold is Self().
RUN reuse may use a sequence outside Self().
Better, for a listing, only if the later final e is lower.
A shorter path is a note. A tie on final e is not a win.

## Navigation strategy

Home is A. Workbench is B. That split is the product, not a layout preference.

| Surface | Role | Customer meaning |
|---|---|---|
| `/` Home A | Controller | Goal, task, namer of y. Music is the first vertical. |
| `/workbench` Workbench B | Environment | The SaaS plant. Runs, domains, audit, listed experience. |
| Diagnostic | Plant on B | Validation of y against a reference. Not a header product. |
| Proof | Plant on B | Cold plant, then reuse plant. Not a header product. |
| Audit | Plant on B | Frozen run + digest when Δe stalls. Human review desk. |
| Marketplace / Playlist / Songs | Kept rails | Assets already listed. Traction stays on the page. |

Diagnostic, Proof, and Audit do not sit next to Home as sibling products.
They open from Workbench B.

Domain select `safety` / `compliance` lands on `/workbench`.
Domain select `music` lands on `/`.

## What was built (and is kept)

Shiyan already shipped the loop. Aethel Node commercializes that loop without replacing it.

| Built | Role | Where | Status |
|---|---|---|---|
| Closed loop | A acts, B transitions, z is measured, e is scored, Self() names next y | `src/lib/closed-loop.ts` | Kept. Self() still does not read prior Runs. |
| Controller A | Task, policy, evaluator, memory, Self(). Names y. Not a product. | engine | Kept |
| Environment B | Workbench. W(B,y) produces experience. Not a customer. | `/workbench` | Commercial core |
| Namers of y | Grok fast, Hy4 deep, Grok Bot. Interchangeable. Not the product. | inside A | Kept |
| Music vertical | Home. First commercial rail. | `/` | Live |
| Workbench B | Outcome Engine. Start / step / close a Run. List experience. | `/workbench` | Live |
| Safety pack | Evidence gate. HOLD / CLINICIAN_REVIEW / ESCALATE. | `/workbench/safety` | Live |
| Proof | Cold versus reuse. Φ = e_cold(final) − e_reuse(final). | `/workbench/proof` | Live. 2026-10-02. |
| Reuse policy | Outside Self(). A sequence lists only if final e falls. | `src/lib/reuse-policy.ts` | Live |
| Marketplace | Two listed singles + path for listed e / experience | `/marketplace` | Live |
| Playlist / Songs | Shiyan Yishu — First Single, Sleep Terrors — Second Single | `/playlist` `/single` | Live assets |
| Prove rail | NFT / proof path for the same two works | `/nfts` | Kept |
| Commercial wrapper | Run identity, Δe, history. Does not edit the loop. | `src/product/run.ts` | Kept |
| OnRail | Workspace A vendor env + Workspace B buyer scope | `onrail/` | In scope |

Core loop = kept. Commercialization = additive.
`mark_boundary` and `seal_pack` were added to W. Self() was not taught to read M.

## New in this development

Date: 2026-10-02. `/workbench/proof` heading: Cold plant, then reuse plant.

The 2026-10-01 page was a path win only. Run #001 ended `1.561 → 0.165`. Reuse on the later packs ended `1.399 → 0.216`. Steps and ESCALATE improved. Final e did not. That refusal stays in the record.

The current page scores a sequence outside Self():

`mark_boundary → complete_field → request_independent_check → seal_pack`

The mark does not change e. The seal is the drop. The gate ends HOLD.

| Pack | Cold Self() | Reuse final | Φ | Used |
|---|---|---|---|---|
| Incomplete evidence pack | `1.561 → 0.165` | `0.151` | `0.014` | yes |
| Missing measurements | `1.399 → 0.216` | `0.151` | `0.065` | yes |
| Provenance gap | `1.399 → 0.216` | `0.151` | `0.065` | yes |

The page says all three later plants beat cold final e.
That is an error win on these three packs. It is not a diagnosis.
No settled payment. An unsettled receipt is not revenue.

## Assets that stay listed

Do not orphan traction while the engine generalizes.

| Asset | Rail | Why it stays |
|---|---|---|
| Shiyan Yishu — First Single | `/single` `/playlist` `/marketplace` `/nfts` | Founder proof. First listed work. |
| Sleep Terrors — Second Single | `/single` `/playlist` `/marketplace` | Second listed work. Same settlement path. |
| Listed e / experience | `/marketplace` | Validated Φ may become a reusable asset. Not listed as a settled sale. |

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
Φ > 0 is the error win. A model confidence score is not e.

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
| Φ | e_cold(final) − e_reuse(final). The listing test. |

| Added plant | Path | Job |
|---|---|---|
| Diagnostic state schema | `src/product/diagnostic.ts` | Structured case + reference framework |
| Deterministic scorer | `src/lib/evaluators/diagnostic-rules.ts` | Spike e when a pathway skips prerequisites |
| Gatekeeper | `src/workbench/safety/gatekeeper.ts` | HOLD / CLINICIAN_REVIEW / ESCALATE / FROZEN + digest |
| Engine hook | `src/lib/engine.ts` | New workbench = schema + error function |
| Review desk | `/audit` | Human-in-the-loop when Δe stalls |
| Proof | `/workbench/proof` | Cold plant, reuse plant, Φ per pack |
| Reuse policy | `src/lib/reuse-policy.ts` | Outside Self(). Keeps a sequence only if final e falls. |

Safety remains an evidence gate. It is not a diagnostic device.
No production PHI. No unsupervised clinical decision.

## Commercial vector

| Asset | Customer value | Monetization | Evidence |
|---|---|---|---|
| Auditable verification logs | Every y was simulated, z measured, e scored before execution | Per-run / API | Proof records y, z, e, steps, gates, Φ. |
| Sovereign engine architecture | Swap models or hosts; keep M | On-prem / enterprise seat | Namers swap. Self() does not read M. |
| Verified experience marketplace | Discover or list loop policies that already cut e | Platform fee | Two singles listed. Three Safety packs now beat cold final e. Not a settled sale. |

Do not commercialize the AI. Commercialize the closed-loop outcome.
A Safety Φ may be named on the proof page. It is not revenue until a payment settles.

## Surfaces

| URL | What the customer sees |
|---|---|
| `/` | Home A. Music vertical. Workbench, Marketplace, Playlist, Songs. |
| `/workbench` | Workbench B. Run plant. Diagnostic, Proof, and Audit open here. |
| `/workbench/safety` | Diagnostic validation plant on B. |
| `/workbench/proof` | Cold plant, then reuse plant. Φ per pack. |
| `/audit` | Review desk. Frozen digests. |
| `/marketplace` | First Single + Sleep Terrors. Experience can list. |
| `/playlist` | Settlement rail for those two assets. |
| `/single` | Play / Prove for those two assets. |
| `/nfts` | Prove rail. |
| `/loop` | Protected loop runner. |
| `/architecture` | Spec. |

`/workspace` and `/run` redirect into home and Workbench.
They are not separate products.
`/workbench/loop` is not a page.

## How we develop from here

Adjust as we go. Add to what exists. Do not rewrite the loop to announce a new narrative.

Development criteria for the next change:

1. Do not teach Self() to read prior Runs.
2. Keep the two listed works and their rails.
3. A claim is allowed only if `/workbench/proof` shows it.
4. "Used experience" means the reuse sequence is printed and its final e is below cold.
5. "Better," for a listing, means a lower final e. Fewer steps or fewer ESCALATE gates are a path note. A tie on final e is not an error win.
6. "Customer value" means a settled payment for that record. An unsettled receipt does not count.
7. No new vertical until this Safety comparison is the page a buyer opens.

Tentative, not measured:

- List the three winning sequences only as experience, with Φ on the row, after a second Run repeats the drop.
- Leave the $49 receipt unsettled until a payment clears.
- Carry the same outside policy onto Compliance without a new A.
- Keep `/loop` as the runner. Do not add `/workbench/loop`.

## Unicorn Development Status

Aethel Node becomes potentially enormous if it can become the infrastructure layer through which organizations turn real-world actions and outcomes into reusable machine experience across many Workbench environments.

That sentence is the thesis. It is not a measurement.

| Claim | Status on 2026-10-02 |
|---|---|
| A acts on B, produces z, calculates e/Δe | Shown. Cold Self(), e `1.561 → 0.165`. |
| A later run uses a sequence outside Self() | Shown. `mark_boundary → complete_field → request_independent_check → seal_pack`. |
| The later run has lower error | Shown on three packs. Φ `0.014`, `0.065`, `0.065`. |
| The later run is safer | Not the claim. The error win is the final e. |
| Customers pay for the outcome | Not shown. |
| The same engine works across multiple Bs without rebuilding A | Music and Safety use the same A. Compliance is named, not built. |
| Experience compounds across many workbenches | Not shown. One B. |
| Customers or partners create new B environments | Not shown. |
| Revenue grows faster than engineering effort | Not shown. |

Commercial development is underway on the Shiyan engine.
The first customer-facing primitive is a Run on Workbench B.
The smaller proposition still open:

A acts on B → B produces measurable z → experience → better next action → lower e → customer value

Lower e is now visible on three Safety packs. Customer value is not.

Repo: https://github.com/ecmccready/shiyan-dap
Live: https://shiyan-dap.vercel.app
# Aethel Node

Sovereign multi-model orchestration and multi-domain workspace infrastructure (formerly Shiyan-DAP).

Live: https://shiyan-dap.vercel.app  
Repo: https://github.com/ecmccready/shiyan-dap

Aethel Node is commercial development on what Shiyan already built.  
The repo name is still `shiyan-dap`.  
The product name is Aethel Node.  
The engine did not get replaced.

Keep what works. Add the next commercial plant. Do not reset traction.

## Live commercial path (2026-10-12)

Developmental stack is the product. Public packs are the proof. Client reference is the next plant.

| Surface | Role | Live |
| --- | --- | --- |
| /workbench | Commercial center | https://shiyan-dap.vercel.app/workbench |
| /workbench/review | Acquirer / funding one-pager | https://shiyan-dap.vercel.app/workbench/review |
| /workbench/offer | Solicitation | https://shiyan-dap.vercel.app/workbench/offer |
| /workbench/optimus | Model 3 sealed + Optimus 2026 proof | https://shiyan-dap.vercel.app/workbench/optimus |
| /workbench/client | Target-client pipeline + exportable Run | https://shiyan-dap.vercel.app/workbench/client |
| /workbench/history | Inspectable Runs | https://shiyan-dap.vercel.app/workbench/history |
| /workbench/marketplace | Verified sequences (not settled) | https://shiyan-dap.vercel.app/workbench/marketplace |
| /workbench/proof | Safety proof (Φ 0.014 / 0.065 / 0.065) | https://shiyan-dap.vercel.app/workbench/proof |

Φ only when final e falls. Same sealed sequence across Safety, Optimus, and Client plants.  
Not a diagnosis. No PHI. Not revenue until a client settles.  
Healthcare diagnostics remains a higher-risk, later vertical.  
Self() does not yet read prior Runs. Level 3 is the next architectural milestone.

## 2026-10-12 · Optimus reference pack, client pipeline, solicitation surface

What was added today. Prior wins stay in the record.

- Optimus pipeline plant on `/workbench/optimus`.  
  Public reference criteria from late Sep–Oct 2026 reporting (hands still manual, hundreds/week vs higher targets, sensor reliability).  
  Model 3 2018 admission treated as the sealed historical reference: cold = pure “machine that builds the machine” claim; reuse/correction = dial back automation theater, remeasure throughput and rework; final e fell relative to the pure-automation path.  
  Three packs scored with the sealed sequence outside Self(): Φ 0.51 / 0.45 / 0.38.  
  Same refusal rule as Safety. Not a useful-work claim. Not revenue.

- Client pipeline on `/workbench/client`.  
  Same loop. Client supplies the repeated workflow and the objective reference.  
  Export button downloads the Run JSON and stores it locally.  
  Commercial fields recorded on the same Run (cost, latency, success rate, customer-approved value).  
  Explicit boundary: unsettled receipt is not revenue.

- History on `/workbench/history` now lists the exported client Runs stored in the browser.  
  Permanent inspectable record of identifier, reference, Φ, and commercial fields.

- Marketplace on `/workbench/marketplace`.  
  Lists the sealed sequence as a verified reusable workflow (Safety Φ and Optimus Φ).  
  Not settled. Not revenue.

- Offer on `/workbench/offer` and Review on `/workbench/review`.  
  Single-entry solicitation and acquirer one-pager.  
  Links every commercial surface. States the Level 3 boundary.

- Commercial center on `/workbench` now leads with Review, Offer, Client, Optimus, Marketplace, History.

Prior Safety proof (Φ 0.014 / 0.065 / 0.065), peer proof, MCP split, actor network, and music assets remain unchanged.  
The engine did not get replaced. Self() still does not read prior Runs.

## What this is

Customers do not buy "Shiyan DAP," an AI, or a state machine.

They buy a system that repeatedly takes an action, observes the result, measures the error against a reference, and uses that experience to choose the next action.

- Sales: turn operational experience into the next best action.
- Technical: a model-portable closed-loop execution system where intelligence is measured by reduction of error, not by model output alone.
- Unit they operate: a **Run** on **Workbench B**. Metric: **Δe**.

HOME A controller · music vertical · namers of y │ ▼ WORKBENCH B commercial plant · SaaS surface Run | Diagnostic | Proof | Audit | Experience │ ▼ W(B,y) → measured z → error e → Self() → y' → repeat


Organization → Workspace A → Workbench B → Run → Experience → Marketplace

The proof object, on Safety, is:

RUN cold is Self().  
RUN reuse may use a sequence outside Self().  
Better, for a listing, only if the later final e is lower.  
A shorter path is a note. A tie on final e is not a win.

The peer proof does not replace that object. Same A. Two MCP servers. Φ stays inside the plant that produced it.

Engine and commercial layer stay separate.

A ↔ B ↔ Run ↔ Measurement

Organization → Workspace → Workbench → Usage → Billing → Marketplace

A Run may carry a network version:

R = (N, A, B, y, z, e, Δe, Φ)

N is context. It is not e. An observed relationship is not causation.

## Navigation strategy

Home is A. Workbench is B. That split is the product, not a layout preference.

| Surface | Role | Customer meaning |
| --- | --- | --- |
| / Home A | Controller | Goal, task, namer of y. Music is the first vertical. |
| /workbench Workbench B | Environment | The SaaS plant. Runs, domains, audit, listed experience. |
| Diagnostic | Plant on B | Validation of y against a reference. Not a header product. |
| Proof | Plant on B | Cold plant, then reuse plant. Not a header product. |
| Audit | Plant on B | Frozen run + digest when Δe stalls. Human review desk. |
| MCP | Plant on B | Open host/server contract. Not a header product. |
| Peer proof | Plant on B | Same A, B1 and B2. Not a header product. |
| Actor network | Context on B | Documented actors and handoffs. Not a controller. |
| Marketplace / Playlist / Songs | Kept rails | Assets already listed. Traction stays on the page. |

Diagnostic, Proof, Audit, MCP, the peer proof, and the actor network do not sit next to Home as sibling products.  
They open from Workbench B.

Domain select `safety` / `compliance` lands on `/workbench`.  
Domain select `music` lands on `/`.

Header chrome stays: Aethel Node, section label, Home, Workbench, Marketplace, Playlist, Songs, Domain, Upload.

## What was built (and is kept)

Shiyan already shipped the loop. Aethel Node commercializes that loop without replacing it.

| Built | Role | Where | Status |
| --- | --- | --- | --- |
| Closed loop | A acts, B transitions, z is measured, e is scored, Self() names next y | src/lib/closed-loop.ts | Kept. Self() still does not read prior Runs. |
| Controller A | Task, policy, evaluator, memory, Self(). Names y. Not a product. | engine | Kept |
| Environment B | Workbench. W(B,y) produces experience. Not a customer. | /workbench | Commercial core |
| Namers of y | Grok fast, Hy4 deep, Grok Bot. Interchangeable. Not the product. | inside A | Kept |
| Music vertical | Home. First commercial rail. | / | Live |
| Workbench B | Outcome Engine. Start / step / close a Run. List experience. | /workbench | Live |
| Safety pack | Evidence gate. HOLD / CLINICIAN_REVIEW / ESCALATE. | /workbench/safety | Live |
| Proof | Cold versus reuse. Φ = e_cold(final) − e_reuse(final). | /workbench/proof | Live. 2026-10-02. |
| Flywheel on B | Same sealed sequence as Proof. Claim only if final e falls. | /workbench | Live. 2026-10-03. |
| Reuse policy | Outside Self(). A sequence lists only if final e falls. | src/lib/reuse-policy.ts | Live |
| MCP contract | y, z, e, Δe, Φ as an open client-server interface. | src/lib/mcp/schema.ts | 2026-10-05. Interface, not a partner. |
| MCP host | Controller A. JSON-RPC only. Does not import B. | src/lib/mcp/host.ts | 2026-10-05. 89a0797 |
| MCP server | Workbench B. Tools, resources, scored e. | src/lib/mcp/handler.ts | 2026-10-05. 3dea3d4 |
| MCP page | Decoupled loop, opened from B. Header unchanged. | /workbench/mcp | 2026-10-05. 0b94734 |
| B2 identity | Independent server. A does not import the plant. | GET /api/b2 | Live. e0f921c |
| Peer proof | Same host. B1 and B2 both printed. | /workbench/compare | 2026-10-07. 58dfbd9. Not a cross-plant win. |
| Repeat | Sealed sequence twice on B1. | /workbench/repeat | Both passes fell. Does not replace Safety. |
| Marketplace | Two listed singles + path for listed e / experience | /marketplace | Live |
| Playlist / Songs | Shiyan Yishu — First Single, Sleep Terrors — Second Single | /playlist /single | Live assets |
| Prove rail | NFT / proof path for the same two works | /nfts | Kept |
| Commercial wrapper | Run identity, Δe, history. Does not edit the loop. | src/product/run.ts | Kept |
| OnRail | Workspace A vendor env + Workspace B buyer scope | onrail/ | In scope |
| Actor network | Context and provenance layer. Not a controller. | src/lib/network/context.ts | 2026-10-09. Not a measurement. |

Core loop = kept. Commercialization = additive.  
`mark_boundary` and `seal_pack` were added to W. Self() was not taught to read M.  
The MCP refactor moves that same pair across JSON-RPC. It does not teach Self() to read M.  
The actor network does not replace that pair.

## New in this development

Date: 2026-10-02. `/workbench/proof` heading: Cold plant, then reuse plant.

The 2026-10-01 page was a path win only. Run #001 ended `1.561 → 0.165`. Reuse on the later packs ended `1.399 → 0.216`. Steps and ESCALATE improved. Final e did not. That refusal stays in the record.

The current page scores a sequence outside Self():

`mark_boundary → complete_field → request_independent_check → seal_pack`

The mark does not change e. The seal is the drop. The gate ends HOLD.

| Pack | Cold Self() | Reuse final | Φ | Used |
| --- | --- | --- | --- | --- |
| Incomplete evidence pack | 1.561 → 0.165 | 0.151 | 0.014 | yes |
| Missing measurements | 1.399 → 0.216 | 0.151 | 0.065 | yes |
| Provenance gap | 1.399 → 0.216 | 0.151 | 0.065 | yes |

The page says all three later plants beat cold final e.  
That is an error win on these three packs. It is not a diagnosis.  
No settled payment. An unsettled receipt is not revenue.

## Benefit on 2026-10-03

The surfaces were split back apart. Home is Aethel Node. Workbench is B. `/loop` is the runner. Shiyan Yishu stays the proof single, not the platform name.

`/workbench` had been claiming a flywheel on a path win. Case 2 and Case 3 reused prior y, ended `1.399 → 0.216`, and matched cold final e. Fewer steps and fewer ESCALATE gates were a note. That claim was refused.

The flywheel on `/workbench` now runs the same sequence already scored on `/workbench/proof`, outside Self():

`mark_boundary → complete_field → request_independent_check → seal_pack`

Live on 2026-10-03, commit `cbb3391e`:

| Pack | Cold Self() | Reuse final | Φ | Better |
| --- | --- | --- | --- | --- |
| Incomplete evidence pack | 1.561 → 0.165 | 0.151 | 0.014 | yes |
| Missing measurements | 1.399 → 0.216 | 0.151 | 0.065 | yes |
| Provenance gap | 1.399 → 0.216 | 0.151 | 0.065 | yes |

The mark leaves e unchanged. The seal is the drop. Case 2 and Case 3 beat cold final e, `0.216 → 0.151`. That is the flywheel claim. A tie is not.

Build insight: a shorter path is not the benefit. The benefit is a lower final e, printed, on a sequence outside Self(). Self() was not taught to read prior Runs.

No settled payment. The charge line still says no charge yet. An unsettled receipt is not revenue.

## MCP refactor on 2026-10-05

The refactor turns the bespoke import of `src/lib/engine.ts` into an open orchestration contract. It does not replace the engine. It does not move MCP into the header.

Enterprise buyers do not pay for generated text. They pay for a system that repeatedly takes an action, measures error against a reference truth, and uses compiled experience to reduce that error (Δe). A partner must be able to spin up Workbench B without a rewrite of Controller A.

The recorded Φ rows stay the claim: `0.014`, `0.065`, `0.065`, commit `cbb3391e`. A live tool call is a new plant. It does not overwrite those rows. No settled payment. A partner environment is the interface, not yet a customer.

## Peer proof

A does not change. If B2 can be independently implemented and A can operate it without modification, the portability claim is an interoperability property, not only a diagram.

Comparable means both plants printed z and e. B2 beating B1 is not an error win. Each Φ stays on its plant. These rows do not replace the Safety proof.

## Repeat

`/workbench/repeat` ran the sealed sequence twice on B1. Cold final was passed in. Self() did not read a prior Run. The reduction repeated on this plant. It does not replace the Safety rows. No settled payment.

## Assets that stay listed

Do not orphan traction while the engine generalizes.

| Asset | Rail | Why it stays |
| --- | --- | --- |
| Shiyan Yishu — First Single | /single /playlist /marketplace /nfts | Founder proof. First listed work. |
| Sleep Terrors — Second Single | /single /playlist /marketplace | Second listed work. Same settlement path. |
| Listed e / experience | /marketplace | Validated Φ may become a reusable asset. Not listed as a settled sale. |

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

## Autonomy levels

Level 1 — Execute and measure  
Level 2 — Reuse verified experience  
Level 3 — Learn across runs (Self() uses historical experience)  
Level 4 — Operate autonomously within constraints

The repository documents parts of Levels 1 and 2. Level 3 is the next architectural milestone.

# Aethel Node

Sovereign multi-model orchestration and multi-domain workspace infrastructure (formerly Shiyan-DAP).

Live: [https://shiyan-dap.vercel.app](https://shiyan-dap.vercel.app)  
Repo: [https://github.com/ecmccready/shiyan-dap](https://github.com/ecmccready/shiyan-dap)

Aethel Node is commercial development on what Shiyan already built.  
The repo name is still `shiyan-dap`.  
The product name is Aethel Node.  
The engine did not get replaced.

Keep what works. Add the next commercial plant. Do not reset traction.

## Live commercial path

Developmental stack is the product. Public packs are the proof. Client reference is the next plant.

| Surface | Role | Live |
| --- | --- | --- |
| /workbench | Commercial center | https://shiyan-dap.vercel.app/workbench |
| /workbench/review | Acquirer / funding one-pager | https://shiyan-dap.vercel.app/workbench/review |
| /workbench/offer | Solicitation | https://shiyan-dap.vercel.app/workbench/offer |
| /workbench/optimus | Model 3 sealed + Optimus 2026 proof | https://shiyan-dap.vercel.app/workbench/optimus |
| /workbench/client | Target-client pipeline + exportable Run | https://shiyan-dap.vercel.app/workbench/client |
| /workbench/pilot | Paid pilot gate (behind measured benefit) | https://shiyan-dap.vercel.app/workbench/pilot |
| /workbench/history | Inspectable Runs | https://shiyan-dap.vercel.app/workbench/history |
| /workbench/marketplace | Verified sequences (not settled) | https://shiyan-dap.vercel.app/workbench/marketplace |
| /workbench/proof | Safety proof (Φ 0.014 / 0.065 / 0.065) | https://shiyan-dap.vercel.app/workbench/proof |

Φ only when final e falls. Same sealed sequence across Safety, Optimus, and Client plants.  
Not a diagnosis. No PHI. Not revenue until a client settles.  
Healthcare diagnostics remains a higher-risk, later vertical.  

Self() now consumes approved experience from previous Runs through a defined interface. Level 3 milestone is partially implemented behind the existing A/B interface.

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

Core loop = kept. Commercialization = additive.  
`mark_boundary` and `seal_pack` were added to W.  
The MCP refactor moves that same pair across JSON-RPC.  
The actor network does not replace that pair.

## Autonomy levels

Level 1 — Execute and measure  
Level 2 — Reuse verified experience  
Level 3 — Learn across runs (Self() uses historical experience)  
Level 4 — Operate autonomously within constraints

The repository documents parts of Levels 1 and 2.  
Level 3 is the current architectural milestone: Self() consumes approved experience from previous Runs through a defined interface. Unsafe or unverified experience is rejected. Causal improvement is measured under matched conditions (improved / tied / regressed).

## Level 3 commercial surfaces (this slice)

- Server-side Run persistence with workspace/client ID, workflow version, model version, metrics, and provenance (`run-store.ts`).
- Self() retrieves only approved, safety-passed, positive-Φ experience (`approved-experience.ts`).
- Causal comparison of cold vs reuse on matched cases (`causal-proof.ts`).
- Client proof record: inspect a Run and export JSON evidence without internal architecture (`/workbench/client`).
- Paid pilot gate remains behind a confirmed improved Run under safety constraints (`/workbench/pilot`).

Marketplace stays downstream of the proof system. A tie in final e is not an improvement.

## Assets that stay listed

Do not orphan traction while the engine generalizes.

Music is the first vertical, not the product boundary.
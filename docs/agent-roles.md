# Agent roles (stubs)

Two roles sit around the existing engine. Neither is a built autonomous agent today: this file defines what each is for, where a human must approve, and which existing pages and endpoints each uses. The engine (the Level 4 run, its safety gates, the experience store, the verify and anchor endpoints, and the micro-ledger) stays the authority. An agent organizes and communicates what the engine recorded; it does not decide whether a result is valid and it does not change the Level 4 loop.

## The journey these roles serve

| Step | What happens | Primary page | Evidence and endpoints |
| --- | --- | --- | --- |
| 1. Declare the problem | The customer states a measurable outcome, baseline, constraints and success threshold. | `/workbench/outcome`, `/workbench/client` | The declared goal is kept in the browser session today. |
| 2. Bounded execution | The Level 4 run executes under safety and budget gates and records every transition. | `/workbench/autonomous` | `/workbench/safety`, `/workbench/history`, `/api/level4/run` |
| 3. Verify the evidence | Replay and verify the run, read measured e, Δe and Φ, disclose failed checks, export the evidence pack. | `/workbench/result` | `/api/level4/verify`, `/api/level4/anchor` (dry run), `/api/level4/experience`, `/api/v1/ledger/assets`, `/api/v1/audit/summary` |
| 4. Validate the value | The customer reviews the result and decides on a paid pilot. | `/workbench/pilot`, `/workbench/review`, `/workbench/offer` | Actual economic benefit is recorded by the customer outside the product today. There is no recording surface yet. |

The same four steps are returned as `journeySteps` by `GET /api/v1/status`.

## Agent A: customer acquisition

Purpose: find organizations with a costly, measurable workflow problem and match them to something the engine can already demonstrate.

Responsibilities:
- Identify prospects and research them from public sources.
- Match each prospect to a demonstrable capability (for example the sealed reference runs on `/workbench/shiyan` and `/workbench/proof`), and say plainly when there is no match.
- Prepare outreach drafts that link to `/workbench/pilot` and `/workbench/offer`.
- Track responses and pilot conversion (who replied, who was sent to `/workbench/client`, who approved a pilot).

Human-approval gates:
- Every outreach message is reviewed and sent by a person. The agent drafts; it never sends.
- Any price, commitment or claim about results needs approval. Claims must come from a verified run or the evidence pack, never from the draft.
- Moving a prospect to "pilot approved" is a human decision.

Existing surfaces it reads: `/workbench/pilot`, `/workbench/offer`, `/workbench/review`, `/workbench/result` (public proof URLs), `/api/v1/status` (`journeySteps`, `phaseLine`).

## Agent B: product evidence

Purpose: run approved demos against a defined reference and turn what the engine recorded into a customer-readable evidence pack.

Responsibilities:
- Run only demos a person has approved, through the existing Level 4 flow (`/workbench/outcome` then `/workbench/autonomous`).
- Collect the execution records and verification results (`/api/level4/experience`, `/api/level4/verify`, `/api/level4/anchor`, and the ledger lines).
- Produce the evidence pack from `/workbench/result` (Export evidence pack), which lists measured e, the recorded baseline (e0 and cold e), Δe, Φ, every link, and the disclosures.
- Compare baseline with the measured outcome, flag failed checks, and flag unsupported claims (for example a Φ claim on a run that did not meet the threshold, or an audit result presented as a third-party attestation).

Human-approval gates:
- A person approves each demo before it runs and each evidence pack before it goes to a customer.
- A failed check or an unsupported claim is reported to the person, not smoothed over.

Limits:
- The audit summary is a heuristic mock scan, not a third-party attestation. The Merkle root and the anchor endpoints are dry runs; nothing is submitted on-chain.
- The agent never edits the Level 4 loop, never purges the ledger, and never uses admin secrets.

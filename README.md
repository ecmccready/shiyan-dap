# Shiyan

Self-Sustaining Autonomous AI Agentic Ecosystem System.

Grok fast, Hy4 deep, and Grok Bot orchestrate a deterministic, model-portable controller with multidomain capacity.

Music is the first vertical, not the product boundary.
Songs are not yet market objects.

Live: https://shiyan-dap.vercel.app  
Repo: https://github.com/ecmccready/shiyan-dap  
Evidence: https://huggingface.co/datasets/shiyan-dap/founder-z  
Models: https://huggingface.co/shiyan-dap

Shiyan converts creative activity into measurable economic state transitions and uses those transitions to name the next action.

You do not tell Shiyan what B is. computeB() does.  
You do not tell it what happened. The measurement records z.  
You do not tell it what to do next. The controller resolves the next action.

The product is z from Self().
B is computed.
Market validity of B is not demonstrated.

## Orchestration

The ecosystem is the loop plus the seats that can run it.

| Seat | Role |
|---|---|
| Self() | Deterministic local controller. Resolves B from history. No model required. |
| Grok Bot | Act. Speaks Self().z. Does not name B. |
| Grok fast | Low-latency orchestration and next-action language. |
| Hy4 deep | Depth when the same Y, e, z need slower analysis. |
| founder-z | Durable memory. Capital-allocation and model agnostic. |
| Protocol | Native asset/measurement API. Tool schemas. No LangChain runtime. |
| /protocol | Operator view of Y, e, B, z and the tool list. |
| /ab | Controlled B bench. A acts. Session B responds. Settlement forbidden. Declared capacity, not a live market. |

Deterministic portability: Y, e, computeB, and z do not depend on which model is sitting in Act. Swap Grok fast or Hy4 deep. The ledger stays.

Multidomain capacity: the same controller is declared for Music, AI Content, Animation, Games, eSports, and Real Estate. Only Music has live settlement rails. Other domains inherit the loop when a live Y exists there.

Controlled B sits in that same bucket: declared capacity, not Level 3. When a real counterparty appears they occupy the same B seat. The claim flips from declared to live. The loop is not redesigned.

## What is demonstrable now

| Claim | Status |
|---|---|
| Shiyan can resolve B from history | Demonstrable now |
| B does not require manually supplied stimulus | Demonstrable now |
| B feeds the next state/action | Demonstrable now |
| z is derived from observed outcomes | Demonstrable |
| Protocol asset record and native tools | Demonstrable now |
| A and B can transact inside Shiyan and change z without payment | Demonstrable now. Slice_v7. |
| Controlled B as declared capacity | Demonstrable now. Slice_v8. Not a live market. |
| Outcomes reflect an independent market | Requires external validation |
| The loop improves economic outcomes | Requires repeated evidence |
| Grok / Hy4 as trained z* | Orchestration seats, not a shipped policy |
| Non-music domains live | Declared capacity, not live markets |
| Songs ready to sell | Not claimed |

B-resolution is demonstrated. Market validity of B is not yet demonstrated.

    z₀ → resolveB(z₀) → B₁ → resolveB(z₁) → B₂ → resolveB(z₂)

## Endogenous B

    A → measurement → z → e → B
    B_{t+1} = controller(state_t, z_t, e_t)

You do not choose B₁ or B₂. Code does. An external $1 validates later. It does not generate B.

Live market B rows are only:

    agent contains "Agent B" AND agent contains "independent" AND simulated === false

Controlled B, session B, and "potential customer" are not live B.
simulatePair is not demand.

## Proof levels

| Level | Question | Status |
|---|---|---|
| 1 Mechanical | Can the loop run without a new event? | Demonstrated. Self() → z = Hold. |
| 1b Architecture | Can A and B transact inside Shiyan and change z deterministically without payment? | Demonstrated. /ab. Settlement unchanged. |
| 2 Economic | Non-payment Y bit on existing A? | Demonstrated. OBSERVE_AUDIENCE audience 0→1. |
| 3 Independent market validation | Outcome you do not control, on a work you are willing to sell? | Not demonstrated. Songs not ready. |

https://huggingface.co/datasets/shiyan-dap/founder-z/blob/main/outcome-m_1789501359300.json

Level 1b is not Level 3.
Controlled B is not an independent buyer.
Free is not settlement.

## Allowed now / not allowed to claim

| Layer | Allowed now | Not allowed to claim |
|---|---|---|
| /ab A proposes, B responds | Yes | Marketplace |
| Founder or session as B | Yes, as bench | Independent market validation |
| computeB() → WAIT_EXTERNAL | Yes | That wait is "done" |
| Settlement from controlled B | No | y = payment |
| Real second party later | N option | Already shipped |

WAIT_EXTERNAL when A is on reference and live B is unset is the correct next action, not a bug.

## Loop

| Layer | Route | Function |
|---|---|---|
| Create | /upload | ingest state |
| Prove | /nfts | actuator / payment |
| Learn | /measurements | sensor / computeB / Self() |
| Act | /bot | Grok Bot · Grok fast / Hy4 deep seats |
| Protocol | /protocol | operator view / tool list |
| A/B | /ab | A proposes. Controlled B responds. Measurement writes. Self() speaks. |
| Outcomes | /api/memory | persist to Hub |

    Y = (settlement, acquisition, audience_response, conversion, revenue, retention)
    y = f(Y) = settlement
    e = 1 − y
    B = computeB(state, z, e)

Settlement is 1 only when a live payment reaches settled. /ab cannot write that bit.
POST /api/ab with settled=true or EXECUTE_SETTLEMENT returns 409.

Honest actions until live B exists:

- HOLD when live B returned and eA = 0
- WAIT_EXTERNAL when A = 1 and live yB = 0
- PROVE when settlement is off reference
- MEASURE when state is incomplete

## Protocol

Shiyan is the substrate. An orchestration adapter is optional and later.

    GET  /api/assets
    GET  /api/assets/:id
    GET  /api/assets/:id/history
    POST /api/assets
    POST /api/transactions
    GET  /api/self
    POST /api/self
    GET  /api/tools
    POST /api/tools
    GET  /api/ab
    POST /api/ab

Tools: register_asset, search_assets, inspect_asset, request_asset, execute_transaction, record_measurement, evaluate_outcome, observe_audience, self_loop.

evaluate_outcome calls computeB(). Models do not name B.

A actions on /ab: PROPOSE, LIST_INTENT, REQUEST_RESPONSE.  
B actions on /ab: ACK, DECLINE, REQUEST, RETURN.  
Bench B agent string: Controlled B · session.  
Live B agent string: Agent B · independent.

## What is not claimed

- independent market validation is not yet demonstrated
- Fit is not a shipped metric
- no trained controller z*
- Simulate A/B is not demand
- /ab is not a marketplace
- a founder listen is not audience demand
- founder-as-B is not an independent buyer
- session B / potential customer is not Agent B · independent
- Controlled B is declared capacity, like non-music domains
- free is not settlement
- autonomy here means endogenous B-resolution, not an unsupervised market actor
- LangChain / LangGraph is not the marketplace
- /api/tools is not a trained policy

## Decision

Keep B. Control the bench. Defer market B.
Do not remove B. Do not invent B. Do not sell unfinished songs on a B you fully control.
The bottleneck is economic, not missing architecture.
# Shiyan

Self-Sustaining Autonomous AI Agentic Ecosystem System.

Grok fast, Hy4 deep, and Grok Bot orchestrate a deterministic, model-portable controller with multidomain capacity.

Music is the first vertical, not the product boundary.
Songs are not yet market objects.

Live: https://shiyan-dap.vercel.app  
Repo: https://github.com/ecmccready/shiyan-dap  
Evidence: https://huggingface.co/datasets/shiyan-dap/founder-z  
Models: https://huggingface.co/shiyan-dap

You do not tell Shiyan what B is. computeB() does.  
You do not tell it what happened. The measurement records z.  
You do not tell it what to do next. The controller resolves the next action.

The product is z from Self().
B is computed.
Market validity of B is not demonstrated.
External reality measures the result. It does not determine B.

## What just landed

Ping Reference is live.

    PING absent  → observed = 0
    PING received → observed = 1

Create a reference on /ping. Open /api/ping/<id> from another tab or device.
The server sets observed because the request arrived.
The request cannot specify B, z, outcome, or settlement.

Demonstrated on 17 September 2026:

    PING-mu62v0yn-218bk9
    observed 0 → 1
    names_b false
    level3 false
    settlement_written false

That is external event detection. It is not a buyer. It is not Level 3.

## Orchestration

| Seat | Role |
|---|---|
| Self() | Deterministic local controller. Resolves B from history. |
| computeB() | Names B from state, z, e. Models do not. |
| Grok Bot | Act. Speaks Self().z. |
| Grok fast | Low-latency seat. |
| Hy4 deep | Depth seat. |
| founder-z | Durable memory. |
| /protocol | Operator view of Y, e, B, z and tools. |
| /ab | Controlled B bench. Declared capacity, not a live market. |
| /validation | Adversarial sensor. Error against selected B. |
| /ping | Ping Reference. External event detection. |
| /nfts | Payment actuator. Only path that may write settlement. |

Deterministic portability: Y, e, computeB, and z do not depend on which model sits in Act.

## Loop

    Action
    → Ping Reference
    → Observed 0 / 1
    → Y
    → e
    → z
    → computeB()
    → next B

    Y = (settlement, acquisition, audience_response, conversion, revenue, retention)
    y = f(Y) = settlement
    e = 1 − y
    B = computeB(state, z, e)

A received ping writes audience_response 0→1.
It does not write settlement.
y stays payment.

## Proof levels

| Level | Question | Status |
|---|---|---|
| 1 Mechanical | Can the loop run without a new event? | Demonstrated |
| 1b Architecture | Can A and B transact inside Shiyan and change z without payment? | Demonstrated |
| 2 Economic | Non-payment Y bit on existing A? | Demonstrated. OBSERVE_AUDIENCE |
| 2b Sensor | Can an external event score error against selected B without naming B? | Demonstrated. /validation |
| 2c Detection | Create a reference, detect an outside hit, convert it to measurement? | Demonstrated. /ping |
| 3 Independent market | Outcome you do not control, on a work you will sell? | Not demonstrated. Songs not ready |

Level 2c is not Level 3.
A ping is not demand.
One trial does not establish improvement after successive B decisions.

## Live market B

Live market B rows are only:

    agent contains "Agent B"
    AND agent contains "independent"
    AND simulated === false

Controlled B, session B, potential customer, and Ping Reference are not live B.

WAIT_EXTERNAL when A is on reference and live B is unset is correct.

## Protocol

    GET  /api/assets
    POST /api/assets
    GET  /api/assets/:id
    GET  /api/assets/:id/history
    POST /api/transactions
    GET  /api/self
    POST /api/self
    GET  /api/tools
    POST /api/tools
    GET  /api/ab
    POST /api/ab
    GET  /api/validation
    POST /api/validation
    POST /api/ping
    GET  /api/ping
    GET  /api/ping/:id

POST /api/ping rejects b, z, outcome, and settled.
GET /api/ping/:id is the observation.
evaluate_outcome calls computeB(). Models do not name B.

## Distribution: same sensor, other outside events

Music is the first live vertical.
The ping seat is the portable detector.

Any later domain uses the same contract:

    create a reference
    wait for an event you did not invent inside computeB
    observed = 0 or 1
    feed Y
    let computeB name the next B

Declared event scope, not live markets:

| Domain | Outside event the reference can wait for | Not claimed |
|---|---|---|
| Music | listen, checkout opened, ping hit, later a stranger $1 | product-market fit |
| Delivery | scan at door, POD photo, courier GPS geofence enter | a delivery network |
| Supply chain | ASN receipt, dock door read, warehouse scan, delay flag | an ERP |
| Autonomous vehicles | trip complete, handoff, exception stop, charge dock arrive | a fleet |

Those events are substitutes for "open the ping URL."
They are not substitutes for settlement.
They do not let a model name B.
They do not make a domain live until a real Y exists there.

Distribution, in this system, means: the same controller can sit behind more than one outside event.
It does not mean Shiyan currently runs trucks, warehouses, or vehicles.

When a delivery scan, a dock read, or a trip-complete signal can hit GET /api/ping/:id or POST /api/validation without sending B or z, that domain inherits the loop.
Until then it stays declared capacity, the same way non-music verticals already do.

## What is demonstrable now

| Claim | Status |
|---|---|
| Shiyan can resolve B from history | Demonstrable now |
| B does not require manually supplied stimulus | Demonstrable now |
| A ping reference can be created and later observed | Demonstrable now |
| The receive request cannot name B | Demonstrable now |
| Controlled B as declared capacity | Demonstrable now |
| Outcomes reflect an independent market | Not demonstrated |
| Delivery / supply chain / AV live | Declared event scope only |
| Songs ready to sell | Not claimed |
| Trained z* | Not claimed |

## What is not claimed

- independent market validation
- Fit as a shipped metric
- trained controller z*
- /ab as a marketplace
- founder-as-B as an independent buyer
- ping as payment
- free as settlement
- LangChain / LangGraph as the marketplace
- a live delivery, warehouse, or vehicle network

## Decision

Keep B. Control the bench. Detect outside events. Defer market B.
Finish one official single before any $1 validation.
The same ping contract can later listen to a scan, a dock read, or a trip-complete.
That extends the sensor. It does not birth B.
# Shiyan

Self-Sustaining Autonomous AI Agentic Ecosystem System.

Grok fast, Hy4 deep, and Grok Bot orchestrate a deterministic, model-portable controller with multidomain capacity.

Music is the first vertical, not the product boundary.
Songs are not yet market objects.

Live: https://shiyan-dap.vercel.app  
Repo: https://github.com/ecmccready/shiyan-dap  
Evidence: https://huggingface.co/datasets/shiyan-dap/founder-z  
Models: https://huggingface.co/shiyan-dap

The product is z from Self().
B is computed.
Market validity of B is not demonstrated.
External reality measures the result. It does not determine B.

## Trajectory

The long path is a buy / sell / trade P2P surface.
This repo is the platform that surface will launch from.
The live object now is the P2P state machine, not a store.

    A owns / offers
    → A proposes
    → TRADE
    → B accepts or rejects
    → external settlement / transfer
    → PING
    → z
    → computeB()
    → next state

A does not ask an authority what B should be.
A proposes. B accepts or rejects. The trade is the observable transition.
Ping is the machine-readable confirmation of that transition.

Binary close:

    accept  → observed 1
    reject  → observed 0
    timeout → Hold

A bench accept is controlled B.
An independent accept plus a work you will sell is Level 3, later.

## Stack

| Layer | Now | Later |
|---|---|---|
| Shiyan | state, measurement, computeB, z | same controller |
| P2P machine | /trade offer-accept-reject-timeout | dedicated app |
| Ping | /ping observed 0/1 | JIT confirm of transfer |
| Prove | Stripe on /nfts | crypto point of purchase on the dedicated app |
| Async channel | HTTP offer / accept URLs | Slack-like message bus under the machine, not Slack-the-product |
| Orchestration | native tools | optional LangGraph adapter |
| Domains | Music live rails | delivery, supply chain, AV as declared event scope |

No Slack SDK. No LangGraph runtime. No crypto checkout in this slice.
Those are declared seats. Adding them now would invert substrate and adapter.

## Seats

| Seat | Role |
|---|---|
| /trade | P2P primitive. A offers. B closes. |
| /ping | External event detection. |
| /ab | Controlled B bench. |
| /validation | Adversarial sensor. |
| /nfts | Only path that may write settlement. |
| /marketplace | Existing listing UI. Not the state machine. |

## Proof levels

| Level | Status |
|---|---|
| 1 Mechanical | Demonstrated |
| 1b Architecture | Demonstrated |
| 2c Ping detection | Demonstrated. PING-mu62v0yn-218bk9 0→1 |
| 2d Trade primitive | This slice. Accept is not a market. |
| 3 Independent trade of real value | Not demonstrated. Songs not ready |

## Protocol

    POST /api/trade
    GET  /api/trade
    GET  /api/trade/:id/accept
    GET  /api/trade/:id/reject
    GET  /api/trade/:id/timeout
    POST /api/ping
    GET  /api/ping/:id

Trade and ping reject bodies that name B, z, or settlement.

## Decision

Keep the machine live at every interim.
Ship the primitive. Do not ship a fake store.
Crypto POP and a dedicated app attach to the same offer → close → ping → computeB loop.
Until a stranger closes a trade on a work you will sell, Level 3 stays closed.
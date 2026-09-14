# Shiyan

Creator operating system. Music is the first vertical.

Live: https://shiyan-dap.vercel.app  
Repo: https://github.com/ecmccready/shiyan-dap  
Evidence: https://huggingface.co/datasets/shiyan-dap/founder-z

Shiyan converts creative activity into measurable economic state transitions and uses those transitions to name the next action.

The product is not the catalog. The product is the agentic pipeline:

    creation → provenance → measurement → z → next market action

Music is the first environment used to prove that pipeline. The same mechanics apply in any domain where an independent producer has to move a work from making it to market action.

Current domain references: Music, AI Content, Animation, Games, eSports, Real Estate.  
Only Music has live payment and measurement. The others are declared seats, not proven verticals.

    x → f(x) → z → next action

## Definition

Creative activity is an action \(x\) a person takes on a work: upload, list, acquire, pay, return.

An economic state is the vector \(Y\):

    Y = (settlement, acquisition, audience_response, conversion, revenue, retention)

Each coordinate is 0 or 1. Settlement is 1 only when a live payment reaches `settled`.

A state transition is

    Y_t  --x_t-->  Y_{t+1}

It is measurable when both vectors are written as an OutcomeTransition and stored in the browser and in `founder-z`.

The next action is

    z_t = π(Y_t, x_t)

π today is `pairZ(A, B, returned)`. It is a rule, not a trained model.

x is what the creator or buyer does. Y is whether money and state moved. z is what to do next because of that movement.

x is an agent. f(x) is settlement. Target is 1. gap = 1 − f(x).  
z is the paired result of A and B.  
f(x) = 1 only when the transaction reaches settled.  
Simulate A/B ≠ B.

This does not say Shiyan predicts hits. It does not say Fit is proven. It does not say z* exists. It does not say non-music domains are live.

## Control layer

`/measurements` is the experimental / control layer, not a dashboard.

| Seat | Meaning | Status |
|---|---|---|
| A | known successful transaction | live $1 on 13 Sep 2026 · Music |
| B | independent test transaction | instrument live; independent buyer not proven |
| z | observed relationship | Hub `latest-z.json` = B returned. Hold. |

pairZ:

- A=1 B=0 → next action is a real B payment
- A=1 B=1 → hold
- A=0 B=0 → Prove, then Buy

Do not add features. Complete A → B → z with a real external buyer in Music and preserve the evidence. Other domains reuse the same Y and z when a live settlement exists there.

## Loop

| Layer | Route | Function |
|---|---|---|
| Create | /upload | ingest a work |
| Prove | /nfts | acquire / buy |
| Learn | /measurements | measure outcomes |
| Act | /bot | consume z |

Evidence: https://huggingface.co/datasets/shiyan-dap/founder-z/blob/main/latest-z.json

## What is not claimed

- B is not yet a proven independent buyer
- Fit is not a shipped metric
- no trained policy z*
- Simulate A/B is not demand
- AI Content, Animation, Games, eSports, and Real Estate are not live markets
# Shiyan

Creator operating system. Music is the first vertical.

Live: https://shiyan-dap.vercel.app  
Repo: https://github.com/ecmccready/shiyan-dap  
Evidence: https://huggingface.co/datasets/shiyan-dap/founder-z

Shiyan converts creative activity into measurable economic state transitions and uses those transitions to name the next action.

Shiyan is a feedback system that connects assets to actions, measures the resulting outcomes, and uses those measurements to determine the next action.

It is not a music-AI tool. It is not a SaaS dashboard. Music is the first environment.

## Feedback loop

    State → Control input → Measurement → Output → Error → Next action

| Control concept | Shiyan |
|---|---|
| State Sₜ | asset + measured history |
| Input uₜ | action taken before the next measurement |
| Plant | real market / creative system |
| Output yₜ | observed outcome |
| Measurement | OutcomeTransition |
| Reference rₜ | target; settlement target is 1 |
| Error eₜ | rₜ − yₜ; shipped as `errorSignal` / `gapToOne` |
| Controller π | pairZ(A, B, returned) |
| Next action zₜ | π(Sₜ, uₜ, eₜ) |
| Learning | not shipped; would update π from closed-loop history |

Causal order:

    Action → observed consequence

not

    data → prediction

Shiyan measures whether successive actions reduce the distance between an asset's actual outcome and its reference.

    e = 1  substantial deviation
    e = 0  settlement reached reference

## Definition

    Y = (settlement, acquisition, audience_response, conversion, revenue, retention)

Settlement is 1 only when a live payment reaches `settled`.

    Y_t --x_t--> Y_{t+1}
    y_t = f(Y_t) = settlement
    e_t = 1 - y_t
    z_t = pairZ(A, B, returned)

π is a rule. z* is not shipped.

Simulate A/B ≠ B.

The environment is not a thermostat. Same action does not guarantee the same outcome. The plant is unknown. The reference can change. Measurement can be delayed. Multiple actions interact. That is why B must be an independent transaction, not a simulation.

## Control layer

`/measurements` is the sensor. Prove is the actuator. Hub `founder-z` is the closed-loop history.

| Seat | Meaning | Status |
|---|---|---|
| A | known successful transaction | live $1 · Music · e=0 |
| B | independent test transaction | instrument live; independent buyer not proven |
| z | observed relationship | latest-z.json = B returned. Hold. |

pairZ:

- A=1 B=0 → real B payment
- A=1 B=1 → hold
- A=0 B=0 → Prove, then Buy

The valuable asset is not the UI. It is the closed-loop record: asset → action → conditions → measurement → outcome → next action → whether e fell.

Do not add features. Complete A → B → z with a real external buyer and preserve the evidence.

## Loop

| Layer | Route | Function |
|---|---|---|
| Create | /upload | ingest state |
| Prove | /nfts | actuator / payment |
| Learn | /measurements | sensor / error / z |
| Act | /bot | consume z |

Domains declared: Music, AI Content, Animation, Games, eSports, Real Estate.  
Only Music has live settlement.

## What is not claimed

- B is not yet a proven independent buyer
- Fit is not a shipped metric
- no trained controller z*
- Simulate A/B is not demand
- non-music domains are not live markets
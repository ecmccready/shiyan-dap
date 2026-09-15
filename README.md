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
| Reference rₜ | settlement target = 1 |
| Error eₜ | rₜ − yₜ = `errorSignal` |
| Controller π | `pairZ` + `resolveB` |
| Next action zₜ | π(Yₜ, Bₜ) |
| Learning | not shipped |

Causal order: Action → observed consequence. Not data → prediction.

    e = 1  substantial deviation
    e = 0  settlement reached reference

## B resolution

B is resolved when measured state produces a next action without a new external market event.

    B_{t+1} = f(B_t, ΔY)
    z_t = π(Y_t, B_{t+1})

| B state | Resolution | z |
|---|---|---|
| returned + stable | resolved | Hold |
| returned + incomplete | unresolved | Measure |
| returned + improving | positive | Continue |
| returned + deteriorating | negative | Correct |
| no evidence | unknown | Observe |

Hold is a resolution. Resolution is not success. Do not manufacture another B payment to move z.

Proven 15 Sep 2026 on `/measurements` from existing RETURN + maintained + settlement 1:

- A: r 1 · y 1 · e 0
- B: r 1 · y 1 · e 0 · resolved
- z: B returned. Hold.

No new stimulus was injected.

## Definition

    Y = (settlement, acquisition, audience_response, conversion, revenue, retention)

Settlement is 1 only when a live payment reaches `settled`.

    Y_t --x_t--> Y_{t+1}
    y_t = f(Y_t) = settlement
    e_t = 1 - y_t
    z_t = pairZ(A, resolveB(history))

π is a rule. z* is not shipped. Simulate A/B ≠ B.

## Control layer

`/measurements` is the sensor. Prove is the actuator. Hub `founder-z` is the closed-loop history.

| Seat | Meaning | Status |
|---|---|---|
| A | known successful transaction | live $1 · Music · e=0 |
| B | measured return state | resolved from existing evidence · 15 Sep 2026 |
| z | observed relationship | latest-z.json = B returned. Hold. |

pairZ:

- A=1 B=0 → real B payment
- A=1 B=1 + resolved → Hold
- A=0 B=0 → Prove, then Buy

## Loop

| Layer | Route | Function |
|---|---|---|
| Create | /upload | ingest state |
| Prove | /nfts | actuator / payment |
| Learn | /measurements | sensor / error / resolve B / z |
| Act | /bot | consume z |

Evidence: https://huggingface.co/datasets/shiyan-dap/founder-z/blob/main/latest-z.json

Domains declared: Music, AI Content, Animation, Games, eSports, Real Estate.  
Only Music has live settlement.

## What is not claimed

- B resolved ≠ independent non-founder identity proven
- Fit is not a shipped metric
- no trained controller z*
- Simulate A/B is not demand
- non-music domains are not live markets
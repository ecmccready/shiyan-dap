# Shiyan

Creator operating system. Music is the first vertical.

Live: https://shiyan-dap.vercel.app  
Repo: https://github.com/ecmccready/shiyan-dap  
Evidence: https://huggingface.co/datasets/shiyan-dap/founder-z

Shiyan is a closed-loop economic decision system for creative assets.

It converts creative activity into measurable economic state transitions and uses those transitions to name the next action.

The product is z from Self(). Music is the first test environment, not the product boundary.  
It is not a music-AI tool. It is not a SaaS dashboard.

## Self()

    Self() = π(Y, resolveB(history))

Self() reads observed state only. It does not inject a market event.

End to end from existing evidence:

    A → payment → result
    B → payment → returned result
    measurement → internal resolution → Self() → z = Hold

Written 15 Sep 2026 to `founder-z` as action `SELF`:

- https://huggingface.co/datasets/shiyan-dap/founder-z/blob/main/outcome-m_1789499366999.json
- https://huggingface.co/datasets/shiyan-dap/founder-z/blob/main/latest-z.json

z remains `B returned. Hold.` Hold is a resolution.

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
| Controller π | `Self()` |
| Next action zₜ | Self().z |
| Learning | not shipped |

Causal order: Action → observed consequence. Not data → prediction.

The valuable asset is:

    asset → action → conditions → measurement → outcome → next action → whether e fell

## Three proof levels

| Level | Question | Status |
|---|---|---|
| 1 Mechanical | Can the loop run: action → measurement → e → Self() → z? | Proven 15 Sep 2026. A e=0. B resolved. Self() wrote SELF. z = Hold. No new market event. |
| 2 Economic | Did a controlled action produce a real measurable economic consequence? | Partial. Founder-controlled live $1 settlements exist. A second non-payment Y bit is not yet independently observed. |
| 3 Independent market | Does the loop work when the outcome is not under founder control? | Not proven. Do not manufacture B. |

Simulate A/B is not Level 3.

B is resolved when measured state produces a next action without a new external market event.

    B_{t+1} = f(B_t, ΔY)
    z_t = Self()

| B state | Resolution | z |
|---|---|---|
| returned + stable | resolved | Hold |
| returned + incomplete | unresolved | Measure |
| returned + improving | positive | Continue |
| returned + deteriorating | negative | Correct |
| no evidence | unknown | Observe |

Hold is a resolution. Resolution is not success and is not independent demand.

## Next experiment

Not another page. Not another Self() click. Not a simulated buyer.

Level 2: a second genuine non-payment Y bit on existing A, recorded under a controlled action, written to `founder-z`.

Level 3 waits for an outcome you do not control.

## Loop

| Layer | Route | Function |
|---|---|---|
| Create | /upload | ingest state |
| Prove | /nfts | actuator / payment |
| Learn | /measurements | sensor / error / resolve B / Record Self() |
| Act | /bot | speak Self().z |
| Outcomes | /outcomes | persist ledger to Hub |

    Y = (settlement, acquisition, audience_response, conversion, revenue, retention)
    y = f(Y) = settlement
    e = 1 − y

Settlement is 1 only when a live payment reaches `settled`.

Domains declared: Music, AI Content, Animation, Games, eSports, Real Estate.  
Only Music has live settlement.

## What is not claimed

- Level 3 independent buyer is not proven
- Fit is not a shipped metric
- no trained controller z*
- Simulate A/B is not demand
- non-music domains are not live markets
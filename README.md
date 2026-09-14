# Shiyan DAP

Creator operating system. Music is the first environment.

Live: https://shiyan-dap.vercel.app  
Repo: https://github.com/ecmccready/shiyan-dap  
Evidence: https://huggingface.co/datasets/shiyan-dap/founder-z

Shiyan converts creative activity into measurable economic state transitions and uses those transitions to name the next action.

    creation → transaction → measurement → z → next action
    x → f(x) → z → next action

x is an agent. f(x) is settlement. Target is 1. gap = 1 − f(x).  
z is the paired result of A and B.  
f(x) = 1 only when the transaction reaches settled.  
Simulate A/B ≠ B.

## Control layer

`/measurements` is the experimental / control layer, not a dashboard.

| Seat | Meaning | Status |
|---|---|---|
| A | known successful transaction | live $1 on 13 Sep 2026 |
| B | independent test transaction | instrument live; independent buyer not proven |
| z | observed relationship | Hub `latest-z.json` = B returned. Hold. |

pairZ:

- A=1 B=0 → next action is a real B payment
- A=1 B=1 → hold
- A=0 B=0 → Prove, then Buy

Do not add features. Complete A → B → z with a real external buyer and preserve the evidence.

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
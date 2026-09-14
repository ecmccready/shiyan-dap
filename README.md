# Shiyan DAP

Creator operating system. Music is the first vertical.

Live: https://shiyan-dap.vercel.app  
Repo: https://github.com/ecmccready/shiyan-dap  
Memory: https://huggingface.co/datasets/shiyan-dap/founder-z

Shiyan AI Assist helps an independent creator take a creation to release, audience response, and the next best action.

## Product

The product is not the song.

The product is the decision loop:

    Y_t  --x_t-->  Y_{t+1}
    z_t  =  π(Y_t, x_t)

A creator takes an action x. Shiyan records whether Y moved. Then it names z.

What exists now: deterministic π (`pairZ`) plus a durable copy of z on Hugging Face.  
What it can become:

    z*_t  =  argmax_z  E[ U(Y_{t+1}) | Y_t, x_t, z ]

z* is not shipped.

## Product-market fit

Fit is a person who is not Agent A using Create → Prove → Learn → Act, paying, leaving, coming back, and a measured Y bit moving or holding because of that action.

The B `RETURN` row in `founder-z` is the **reference sample** for that path.  
Fit is still false until that person is independently a non-founder on a later day.

| Test | Status |
|---|---|
| A live $1 | proven 13 Sep 2026 |
| B live checkout `cluster=B` | proven 13 Sep 2026 |
| B `RETURN` instrument | proven |
| Durable z on Hugging Face | proven 14 Sep 2026 `latest-z.json` |
| Act reads Hub z | proven 14 Sep 2026 |
| Independent non-founder on a later day | not proven |
| Learned z* | not proven |

## Loop

Create → Prove → Learn → Act

| Verb | Route | Job |
|---|---|---|
| Create | /upload | ingest a work |
| Prove | /nfts | Buy as A / Buy as B |
| Learn | /measurements | record Y, emit z, hydrate from Hub |
| Act | /bot | speak Hub z |
| Outcomes | /outcomes | persist browser ledger to Hub |

Places: Marketplace `/marketplace` · Playlist `/playlist` · Songs `/single`

Durable files:

- https://huggingface.co/datasets/shiyan-dap/founder-z/blob/main/latest-z.json
- https://huggingface.co/datasets/shiyan-dap/founder-z/blob/main/outcome-m_1789337917348.json

Current z: `B returned. Hold.`

## f(x) → 1

| x | Cluster | f(x) |
|---|---|---|
| A | founder-music | 1 after live $1 |
| B | new-customer reference | 1 after live B checkout |

z = pairZ(A, B, returned):

- A=1 B=1 RETURN → B returned. Hold.

Simulate A/B is not B.

## What is not claimed

- no trained policy
- no product-market fit
- no on-chain mint
- Simulate A/B is not demand
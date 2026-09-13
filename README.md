# Shiyan DAP

Creator operating system. Music is the first vertical.

Live: https://shiyan-dap.vercel.app  
Repo: https://github.com/ecmccready/shiyan-dap  
Memory: https://huggingface.co/shiyan-dap

Shiyan AI Assist helps an independent creator take a creation to release, audience response, and the next best action.

## Product

The product is not the song.

The product is the decision loop:

    Y_t  --x_t-->  Y_{t+1}
    z_t  =  π(Y_t, x_t)

A creator takes an action x, Shiyan records whether Y moved, then names z, the next best action.

Music is the first vertical used to prove that loop. Marketplace, Playlist, and Songs are places inside the loop, not the product.

What exists now: deterministic π (`nextAction`, `pairZ`).  
What it can become: a creator decision engine

    z*_t  =  argmax_z  E[ U(Y_{t+1}) | Y_t, x_t, z ]

z* is not shipped.

## Product-market fit

Fit is not “the single sold.”  
Fit is not founder $1.  
Fit is not Simulate A/B.

Fit for Shiyan:

A person who is not Agent A uses Create → Prove → Learn → Act, pays, comes back, and a measured Y bit moves because of an action they took.

Until that happens, product-market fit is false.

| Test | Status |
|---|---|
| A live $1 on cluster A | proven 13 Sep 2026 |
| B live payment | not proven |
| B returns to Learn | not proven |
| Non-founder Y bit besides settlement | not proven |
| Learned z* beats guess | not proven |

Music can stay the first vertical after fit. Fit still requires B.

## Loop

Create → Prove → Learn → Act

| Verb | Route | Job |
|---|---|---|
| Create | /upload | ingest a work |
| Prove | /nfts | A container, acquire / buy |
| Learn | /measurements | record Y_t → Y_{t+1}, emit z_t |
| Act | /bot | consume z_t |

Places: Marketplace `/marketplace` · Playlist `/playlist` · Songs `/single`

## f(x) → 1

P2P and A/B agents are one function.

| x | Cluster | Container | f(x) |
|---|---|---|---|
| A | cluster:A | container:founder-music | 1 after live $1 settle |
| B | cluster:B | container:new-customer | 0 placeholder |

Machine
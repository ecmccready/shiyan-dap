# v0.1.24 closed-loop cycle profile

Icarus, held-out seed 9, 16 frames each of low, medium, high and very high. The RTL parameter is ADDR_W 11. `cfg_D` is 256, 1024 or 2048. Three engines share the v0.1.22 codec and `scp4d_k1_tap`: trimmed K1 (`scp4d_ede`), the v0.1.23 hybrid, and a pure full-scan loop (`scp4d_fsd`). No place-and-route. Power is **needs real board**.

Each wall cycle is one bucket: `busy` (engine `in_ready` low), `idle` (engine ready, tap has no token), or `handoff` (engine accepts a token). `tap_full` overlaps those buckets: the tap `room` signal is low and the decoder is stalled. Raw rows: `fixtures/scp/v0124-profile.csv`. Totals: `fixtures/scp/v0124-profile.json`.

| ADDR_W | engine | wall | engine counter | busy | idle | handoff | tap_full | fsd frames |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 8 | ede | 18643 | 15546 | 12955 | 3097 | 2591 | 15628 | 0 |
| 8 | hybrid | 20808 | 16140 | 13613 | 4604 | 2591 | 17597 | 15 |
| 8 | fsd | 40767 | 35679 | 33088 | 5088 | 2591 | 38424 | 64 |
| 10 | ede | 74342 | 61602 | 51463 | 12740 | 10139 | 63838 | 0 |
| 10 | hybrid | 82683 | 63657 | 53582 | 18962 | 10139 | 71344 | 15 |
| 10 | fsd | 163151 | 142299 | 132160 | 20852 | 10139 | 155006 | 64 |
| 12 | ede | 149496 | 123268 | 103022 | 26228 | 20246 | 129178 | 0 |
| 12 | hybrid | 166120 | 127296 | 107114 | 38760 | 20246 | 144257 | 15 |
| 12 | fsd | 326734 | 284502 | 264256 | 42232 | 20246 | 310669 | 64 |

Handoff counts match across the three engines. The hybrid's extra wall cycles sit in the very-high band, where it selects full scan for 15 frames and pays one switch.

| ADDR_W | ede very-high wall | hybrid very-high wall | fsd very-high wall |
|---|---:|---:|---:|
| 8 | 11399 | 13534 | 13109 |
| 10 | 45989 | 54299 | 52669 |
| 12 | 92015 | 108608 | 105467 |

At ADDR_W 12 the other three bands differ by at most 16 cycles. Full scan's very-high wall is higher than K1's, because the scan holds `in_ready` low long enough for the tap to stall the codec (`tap_full` 94480 versus K1's 82586) and the idle bucket grows. The engine-only result that full scan uses fewer cycles at very high churn does not hold for this closed loop.

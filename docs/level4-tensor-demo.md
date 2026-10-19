# Level 4 demo tensor

`src/lib/level4/demo-tensor.ts` adds a deterministic, clearly labeled **demo** tensor to `/workbench/autonomous`. It is a plant sensor vector, not a hosted-model embedding.

- `T_out` = `[completeness, contradiction, missing, independent_check]` of the core plant after replaying the applied actions (shape `[4]`, f64).
- `T_ref` = the same components of the reference that `measureE` uses for `case-incomplete-pack`: `[1, 0, 0, 1]`, `H(T_ref) = sha256:26a5e3f903b04fe473c7dd58e4215f451527ca319885d7493c108af562ff9b1f`.
- Metric: Frobenius. ε = 0.16 (the demo goal bound, e < 0.16).
- Checked only at `request_independent_check` and `seal_pack`. Pure observation: it never changes measured e or the proposer.

| Iter | Step | T_out | Distance | Status |
|---|---|---|---|---|
| 3 | request_independent_check | [0.58, 0, 0.42, 1] | 0.594 | MISDIAGNOSIS_VIOLATION |
| 4 | seal_pack | [0.849, 0, 0, 1] | 0.151 | TENSOR_VERIFIED |

The iteration 3 violation is real: the pack is not yet complete at that step. That step is already `eligible:false` (goal not met), so the stored `eligible` flag (`combineEligibility(goal met, tensor check)`) is unchanged for every iteration. The run's state transitions do not read the tensor result. The experience POST carries `tensor_commitment` and `tensor_distance` for iterations 3 and 4, so the ledger view (`?format=ledger`) shows `TENSOR=… T_DIST=…` on those entries.

## MCP example (`/api/mcp`)

```bash
curl -s https://<host>/api/mcp -H 'Content-Type: application/json' -d '{
  "jsonrpc":"2.0","id":1,"method":"tools/call",
  "params":{"name":"run_sealed_sequence","arguments":{
    "case_id":"case-incomplete-pack",
    "tensor":{"out":{"shape":[4],"data":[0.849,0,0,1]},
              "ref":{"shape":[4],"data":[1,0,0,1]},
              "refCommitment":"sha256:26a5e3f903b04fe473c7dd58e4215f451527ca319885d7493c108af562ff9b1f",
              "epsilon":0.16}}}}'
```

Returns a `tensor_seal` with `tensor_status: "TENSOR_VERIFIED"` and distance 0.151. Sending the iteration 3 vector `[0.58,0,0.42,1]` returns `MISDIAGNOSIS_VIOLATION` and the seal fails.

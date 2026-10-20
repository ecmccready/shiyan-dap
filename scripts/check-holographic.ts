// Run: npx tsx scripts/check-holographic.ts
import assert from "node:assert/strict";
import {
  calculateDynamicThreshold,
  verifyHolographicBound,
  independentTensorCheck,
  type Tensor,
} from "../src/lib/level4/tensor";
import { holographicDefaultCheck, requestIndependentTensorCheck } from "../src/lib/level4/seal";

const t4: Tensor = { shape: [4], data: [0.1, 0.2, 0.3, 0.4] };
const t16: Tensor = { shape: [4, 4], data: Array.from({ length: 16 }, (_, i) => i / 16) };
const t64: Tensor = { shape: [64], data: Array(64).fill(0) };

assert.equal(calculateDynamicThreshold(t4), 0.16);
console.log("4 elements  -> maxAllowable", calculateDynamicThreshold(t4), "(=== 0.16)");
assert.equal(calculateDynamicThreshold(t16), 0.32);
console.log("16 elements -> maxAllowable", calculateDynamicThreshold(t16), "(=== 0.32)");
assert.equal(calculateDynamicThreshold(t64), 0.64);
console.log("64 elements -> maxAllowable", calculateDynamicThreshold(t64), "(=== 0.64)");

const out4: Tensor = { shape: [4], data: [0.15, 0.2, 0.3, 0.4] };
const h4 = verifyHolographicBound(out4, t4);
assert.equal(h4.maxAllowable, 0.16);
assert.equal(h4.verified, true);
console.log("holographic 4-elem:", h4);

const fixed = independentTensorCheck({ out: out4, ref: t4, epsilon: 0.16 });
assert.equal(fixed.status, "TENSOR_VERIFIED");
assert.equal(fixed.epsilon, 0.16);
assert.equal(fixed.distance, h4.distance);
console.log("independentTensorCheck (fixed ε) unchanged:", fixed.status, fixed.distance, fixed.epsilon);

// 16-elem: distance 0.3 passes dynamic (0.32) but fails fixed 0.16
const out16: Tensor = { shape: [4, 4], data: t16.data.map((v, i) => (i === 0 ? v + 0.3 : v)) };
const h16 = verifyHolographicBound(out16, t16);
assert.equal(h16.verified, true);
assert.equal(independentTensorCheck({ out: out16, ref: t16, epsilon: 0.16 }).status, "MISDIAGNOSIS_VIOLATION");
console.log("16-elem d=0.3: holographic", h16.verified, "| fixed 0.16 MISDIAGNOSIS_VIOLATION");

assert.throws(() => verifyHolographicBound(t4, t16), /shape mismatch/);
console.log("shape mismatch throws (same as frobeniusDistance)");

// Default (holographic) vs fixed path: holographicDefaultCheck vs requestIndependentTensorCheck.
{
  const shift = (t: Tensor, d: number): Tensor => ({ ...t, data: t.data.map((x, i) => (i === 0 ? x + d : x)) });
  const p16 = { out: shift(t16, 0.3), ref: t16, epsilon: 0.16 };
  const d16 = holographicDefaultCheck(p16);
  const f16 = requestIndependentTensorCheck(p16);
  assert.equal(d16.status, "TENSOR_VERIFIED");
  assert.equal(d16.bound, "holographic");
  assert.equal(d16.max_allowable, 0.32);
  assert.equal(f16.status, "MISDIAGNOSIS_VIOLATION");
  assert.equal("bound" in f16, false);
  console.log("16-elem d=0.3: default", d16.status, d16.max_allowable, "| fixed", f16.status, f16.epsilon);
  const p4 = { out: shift(t4, 0.05), ref: t4, epsilon: 0.16 };
  const d4 = holographicDefaultCheck(p4);
  const f4 = requestIndependentTensorCheck(p4);
  assert.equal(d4.status, f4.status);
  assert.equal(d4.epsilon, f4.epsilon);
  assert.equal(d4.distance, f4.distance);
  console.log("4-elem d=0.05: default", d4.status, d4.max_allowable, "| fixed", f4.status, f4.epsilon, "(identical verdict)");
  const c = holographicDefaultCheck({ ...p16, metric: "cosine" });
  assert.equal(c.bound, "fixed");
  console.log("cosine metric stays fixed:", c.bound);
}
console.log("ALL CHECKS PASSED");

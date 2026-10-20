// Run: npx tsx scripts/check-holographic.ts
import assert from "node:assert/strict";
import {
  calculateDynamicThreshold,
  verifyHolographicBound,
  independentTensorCheck,
  type Tensor,
} from "../src/lib/level4/tensor";

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
console.log("ALL CHECKS PASSED");

"use client";

import { useState } from "react";
import { demoReferenceTensor, DEMO_TENSOR_EPSILON } from "@/lib/level4/demo-tensor";
import { calculateDynamicThreshold } from "@/lib/level4/tensor";

/**
 * Display-only "Holographic bound" toggle. Off by default.
 * Shows the demo tensor's N, fixed ε and the opt-in dynamic maxAllowable.
 * Does not change the run, the seal, or the fixed ε = 0.16 check.
 */
export default function HolographicToggle({ distance }: { distance?: number | null }) {
  const [on, setOn] = useState(false);
  const ref = demoReferenceTensor();
  const n = ref.data.length;
  const maxAllowable = calculateDynamicThreshold(ref);
  const hasDist = typeof distance === "number" && Number.isFinite(distance);
  return (
    <section style={{ margin: "16px 0", padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>
      <label style={{ cursor: "pointer" }}>
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} /> Holographic bound
      </label>
      {on && (
        <ul style={{ margin: "8px 0 0", fontSize: 14 }}>
          <li>Demo tensor elements N = {n}</li>
          <li>Fixed ε = {DEMO_TENSOR_EPSILON}</li>
          <li>Dynamic maxAllowable = ε_base·√(N/4) = {Number(maxAllowable.toFixed(6))}</li>
          {hasDist && (
            <li>
              Latest eligible tensor distance {distance} → {distance! <= maxAllowable ? "passes" : "fails"} the holographic bound
            </li>
          )}
          <li style={{ opacity: 0.7 }}>Display only. The live run keeps fixed ε = 0.16.</li>
        </ul>
      )}
    </section>
  );
}

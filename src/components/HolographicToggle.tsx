"use client";

import { useState } from "react";
import { demoReferenceTensor, DEMO_TENSOR_EPSILON } from "@/lib/level4/demo-tensor";
import { calculateDynamicThreshold } from "@/lib/level4/tensor";

/**
 * Display-only "Holographic bound" toggle. Off by default.
 * Shows the demo tensor's N, fixed ε and the opt-in dynamic maxAllowable.
 * Does not change the run, the seal, or the fixed ε = 0.16 check.
 */
const WHY_016 =
  "0.16 is the calibrated density for a 4-element (2×2) tensor; the dynamic limit scales with √(N/4), so 16 elements → 0.32.";

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
      </label>{" "}
      <span
        role="note"
        tabIndex={0}
        title={WHY_016}
        aria-label={`Why 0.16: ${WHY_016}`}
        style={{ cursor: "help", fontSize: 12, border: "1px solid #999", borderRadius: 999, padding: "0 6px" }}
      >
        ?
      </span>
      <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.75 }}>Why 0.16: {WHY_016}</p>
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

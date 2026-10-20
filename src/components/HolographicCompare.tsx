"use client";

import { useState } from "react";
import { demoReferenceTensor, DEMO_TENSOR_EPSILON } from "@/lib/level4/demo-tensor";
import { calculateDynamicThreshold } from "@/lib/level4/tensor";

/**
 * Display-only "Compare fixed vs holographic" control. Off by default.
 * Shows the fixed ε verdict and the dynamic ε verdict for the latest eligible run's
 * stored tensor distance, side by side. Computed client-side; no API calls or writes.
 */
export default function HolographicCompare({ distance }: { distance?: number | null }) {
  const [on, setOn] = useState(false);
  const ref = demoReferenceTensor();
  const n = ref.data.length;
  const fixed = DEMO_TENSOR_EPSILON;
  const dynamic = calculateDynamicThreshold(ref);
  const has = typeof distance === "number" && Number.isFinite(distance);
  const verdict = (lim: number) => (has ? (distance! <= lim ? "PASS (within)" : "FAIL (over)") : "no tensor distance");
  const cell = { padding: "4px 8px", border: "1px solid #ccc" } as const;
  return (
    <section style={{ margin: "8px 0 16px" }}>
      <button
        type="button"
        aria-pressed={on}
        onClick={() => setOn((v) => !v)}
        style={{ fontSize: 13, padding: "2px 10px", border: "1px solid #999", borderRadius: 6, cursor: "pointer" }}
      >
        {on ? "Hide" : "Compare fixed vs holographic"}
      </button>
      {on && (
        <table style={{ marginTop: 8, fontSize: 13, borderCollapse: "collapse" }} aria-label="Compare fixed vs holographic">
          <thead>
            <tr>
              <th style={cell}>Tensor distance (N={n})</th>
              <th style={cell}>Fixed ε {fixed.toFixed(3)}</th>
              <th style={cell}>Holographic ε {dynamic.toFixed(3)}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={cell}>{has ? distance!.toFixed(3) : "—"}</td>
              <td style={cell}>{verdict(fixed)}</td>
              <td style={cell}>{verdict(dynamic)}</td>
            </tr>
          </tbody>
          <caption style={{ captionSide: "bottom", fontSize: 12, opacity: 0.7, paddingTop: 4 }}>
            Display only. The live run keeps fixed ε = 0.16.
          </caption>
        </table>
      )}
    </section>
  );
}

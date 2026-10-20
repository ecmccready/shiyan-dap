import { demoReferenceTensor } from "@/lib/level4/demo-tensor";
import { calculateDynamicThreshold } from "@/lib/level4/tensor";

/**
 * One-line, display-only "Holographic density" indicator for the latest run's tensor:
 * N, the dynamic limit ε_base·√(N/4), and the run's stored tensor distance.
 * Does not change the run, the seal, or the fixed ε = 0.16 used by the live demo.
 */
export default function HolographicDensity({
  distance,
  showPerElement = false,
}: {
  distance?: number | null;
  showPerElement?: boolean;
}) {
  const n = demoReferenceTensor().data.length;
  const max = calculateDynamicThreshold(demoReferenceTensor());
  const has = typeof distance === "number" && Number.isFinite(distance);
  return (
    <p className="text-xs text-zinc-400 font-mono" aria-label="Holographic density">
      Holographic density · N={n} · dynamic limit {max.toFixed(3)}
      {showPerElement ? ` · per-element tolerance ${(max / Math.sqrt(n)).toFixed(3)}` : ""}
      {has ? ` · tensor distance ${distance!.toFixed(3)} (${distance! <= max ? "within" : "over"})` : " · no tensor distance recorded"}
      {" · display only"}
    </p>
  );
}

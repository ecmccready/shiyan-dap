import Link from "next/link";
import { JOURNEY_STEPS } from "@/lib/journey";

/** One-line proof-to-pilot journey: the four steps, each linked to its primary existing page, in order. */
export default function JourneyNote({ className = "text-zinc-400" }: { className?: string }) {
  return (
    <p className={`text-xs ${className}`} data-journey-note>
      Proof-to-pilot journey:{" "}
      {JOURNEY_STEPS.map((s, i) => (
        <span key={s.step}>
          {i > 0 ? " → " : ""}
          {s.step}.{" "}
          <Link href={s.primary} className="underline">{s.name}</Link>
        </span>
      ))}
      . Each step uses the existing engine and pages; the customer&apos;s own economic benefit is recorded outside the product today.
    </p>
  );
}

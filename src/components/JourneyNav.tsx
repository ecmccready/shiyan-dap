import Link from "next/link";
import { journeyNeighbors } from "@/lib/semiconductor/journey";

export default function JourneyNav({ href }: { href: string }) {
  const { prev, next, current } = journeyNeighbors(href);
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4 text-sm" aria-label="Engineering journey">
      {prev ? (
        <Link className="text-emerald-400 underline" href={prev.href}>Previous · {prev.n} {prev.name}</Link>
      ) : <span className="text-zinc-600">Start of the journey</span>}
      <span className="text-zinc-500">{current.n} {current.name}</span>
      {next ? (
        <Link className="text-emerald-400 underline" href={next.href}>Next · {next.n} {next.name}</Link>
      ) : <span className="text-zinc-600">End of the journey</span>}
    </nav>
  );
}

import { Redis } from "@upstash/redis";
import Level4Shell from "@/components/Level4Shell";
import LatestVerified from "@/components/LatestVerified";
import RunEndpoints from "@/components/RunEndpoints";
import VerifyVerdict from "@/components/VerifyVerdict";
import { latestVerified, type ExperienceEntry } from "@/lib/level4/experience-client";

// Server-rendered on every request so the latest verified result is in the HTML
// (visible without JavaScript, to crawlers, and to buyers' link previews).
export const dynamic = "force-dynamic";

async function loadExperience(): Promise<ExperienceEntry[]> {
  const url = process.env.UPSTASH_KV_REST_API_URL;
  const token = process.env.UPSTASH_KV_REST_API_TOKEN;
  if (!url || !token) return [];
  try {
    const list = (await new Redis({ url, token }).lrange<ExperienceEntry>("level4:experience", 0, -1)) ?? [];
    // Same defensive dedupe as GET /api/level4/experience: first entry per run+iteration.
    const seen = new Set<string>();
    return list.filter((e) => {
      const k = `${e.run_id}:${e.iteration}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  } catch {
    return [];
  }
}

export default async function ResultPage() {
  const experience = await loadExperience();

  return (
    <Level4Shell>
      <main className="mx-auto max-w-xl space-y-8 p-8">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-zinc-500">Result</p>
          <h1 className="text-2xl font-semibold">Verified outcome</h1>
          <p className="text-zinc-300">
            The latest eligible result from a bounded, safety-checked run, read from the durable experience store.
          </p>
        </header>

        <LatestVerified entry={latestVerified(experience)} total={experience.length} />
        <VerifyVerdict />
        <RunEndpoints variant="inline" />

        <p className="text-sm">
          <a href="/workbench/outcome" className="underline text-emerald-400">Declare another outcome</a>
          {" · "}
          <a href="/workbench/status" className="underline text-emerald-400">Full status</a>
        </p>
      </main>
    </Level4Shell>
  );
}

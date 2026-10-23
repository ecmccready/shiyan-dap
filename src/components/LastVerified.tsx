"use client";

import { useHydrated } from "@/lib/use-hydrated";

/**
 * "Last verified <time>" from an entry's existing verified_at timestamp, formatted
 * in the viewer's local time with a zone label. Shows UTC until hydrated so the
 * server-rendered HTML is stable.
 */
export default function LastVerified({ at }: { at: string | null | undefined }) {
  const d = at ? new Date(at) : null;
  const valid = d && !Number.isNaN(d.getTime());
  const hydrated = useHydrated();
  const label = valid
    ? hydrated
      ? d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      })
      : `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`
    : "";

  if (!valid) return null;
  return (
    <p className="text-xs text-zinc-400">
      Last verified <time dateTime={at!}>{label}</time>
    </p>
  );
}

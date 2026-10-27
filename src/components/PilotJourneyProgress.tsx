"use client";

import { useEffect, useState } from "react";
import JourneyProgress from "@/components/JourneyProgress";
import { loadExperienceServer, latestVerified, type ExperienceEntry } from "@/lib/level4/experience-client";

/**
 * The same four-step indicator as /workbench/result, for the pilot page. The run is this browser session's active run when it has a
 * recorded entry, otherwise the latest eligible run. Renders nothing until the experience records have loaded.
 */
export default function PilotJourneyProgress() {
  const [state, setState] = useState<{ loaded: boolean; entry: ExperienceEntry | null }>({ loaded: false, entry: null });
  useEffect(() => {
    let alive = true;
    loadExperienceServer().then((list) => {
      let active = "";
      try { active = window.sessionStorage.getItem("aethel-active-run-id") ?? ""; } catch {}
      const mine = active ? list.filter((e) => e.run_id === active) : [];
      if (alive) setState({ loaded: true, entry: latestVerified(mine.length ? mine : list) });
    });
    return () => { alive = false; };
  }, []);
  if (!state.loaded) return null;
  return <JourneyProgress entry={state.entry} here={4} tone="light" />;
}

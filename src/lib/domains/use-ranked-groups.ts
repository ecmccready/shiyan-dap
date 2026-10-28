"use client";

import { useEffect, useMemo, useState } from "react";
import type { ExperienceEntry } from "@/lib/level4/experience-client";
import { DOMAIN_GROUPS } from "./groups";
import { loadExperienceCached } from "./experience-cache";
import { rankDomainGroups, type RankedDomainGroup } from "./experience-rank";

/** Static order on the server and first paint; ranked and annotated once the (cached) experience read returns. */
export function useRankedDomainGroups(): RankedDomainGroup[] {
  const [entries, setEntries] = useState<ExperienceEntry[]>([]);
  useEffect(() => {
    let active = true;
    loadExperienceCached().then((list) => {
      if (active) setEntries(list);
    });
    return () => {
      active = false;
    };
  }, []);
  return useMemo(() => rankDomainGroups(DOMAIN_GROUPS, entries), [entries]);
}

/** Semiconductor engineering journey. Domain verticals are not stages. */
export type JourneyStage = {
  n: string;
  name: string;
  href: string;
  bring: string;
  get: string;
};

export const JOURNEY: readonly JourneyStage[] = [
  {
    n: "01",
    name: "Discover",
    href: "/assess",
    bring: "A computational workload and the constraint that matters.",
    get: "A written question the assessment can answer.",
  },
  {
    n: "02",
    name: "Characterize",
    href: "/journey/characterize",
    bring: "Inputs, size, and the current implementation.",
    get: "A description of what the workload actually does.",
  },
  {
    n: "03",
    name: "Optimize",
    href: "/journey/optimize",
    bring: "Permission to try 4D-SCP variants on that description.",
    get: "Candidates, including the ones that stop.",
  },
  {
    n: "04",
    name: "Prove",
    href: "/journey/prove",
    bring: "The frozen candidate.",
    get: "Bit-exact checks and place-and-route evidence, labeled separately.",
  },
  {
    n: "05",
    name: "Deploy or hand off",
    href: "/journey/deploy",
    bring: "The evidence pack.",
    get: "A proof package. Physical programming is still outstanding.",
  },
];

export function journeyNeighbors(href: string): { prev: JourneyStage | null; next: JourneyStage | null; current: JourneyStage } {
  const i = JOURNEY.findIndex((s) => s.href === href);
  const current = JOURNEY[i] ?? JOURNEY[0]!;
  return {
    prev: i > 0 ? JOURNEY[i - 1]! : null,
    next: i >= 0 && i < JOURNEY.length - 1 ? JOURNEY[i + 1]! : null,
    current,
  };
}

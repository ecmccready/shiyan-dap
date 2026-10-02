/** Part/whole view of the evidence pack. Persistence shape only. Not e. */
export type PackRegion = {
  part: string;
  present: boolean;
  exterior: boolean;
  overlaps: string[];
};

export function packRegions(input: {
  available: string[];
  missing: string[];
  contradictions: { source: string; note: string }[];
}): PackRegion[] {
  const holes = input.missing.map((part) => ({
    part,
    present: false,
    exterior: part === "provenance" || part === "independent-check",
    overlaps: [],
  }));
  const parts = input.available.map((part) => ({
    part,
    present: true,
    exterior: false,
    overlaps: input.contradictions
      .filter((c) => c.source === part)
      .map((c) => c.note),
  }));
  return [...parts, ...holes];
}
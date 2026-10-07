export const EXPERIENCE_FIELDS = [
  "y",
  "z",
  "e_before",
  "e_after",
  "delta_e",
  "context",
  "provenance",
  "replayability",
] as const;

export const CAPABILITIES = [
  { capability: "Know", manifestation: "verified evidence", href: "/audit" },
  { capability: "Know-how", manifestation: "executable capability", href: "/workbench/mcp" },
  { capability: "Show", manifestation: "observable Workbench", href: "/workbench" },
  { capability: "Do", manifestation: "Run", href: "/workbench/watch" },
  { capability: "Result", manifestation: "z", href: "/workbench/watch" },
  { capability: "Error", manifestation: "e", href: "/workbench/watch" },
  { capability: "Improvement", manifestation: "Δe", href: "/workbench/proof" },
  { capability: "Experience", manifestation: "Φ", href: "/workbench/proof" },
] as const;

export const WATCHED_STEPS = [
  "Problem",
  "A chooses action y",
  "B executes",
  "B produces z",
  "error e calculated",
  "next action selected",
  "error decreases",
  "experience is created",
  "experience is reusable",
] as const;

export const FLYWHEEL = [
  "Run",
  "measurement",
  "proof",
  "Experience",
  "reuse",
  "better Run",
  "new Experience",
] as const;

export const PLANTS = [
  { id: "B1", href: "/api/mcp", note: "Existing MCP server. A does not import it." },
  { id: "B2", href: "/api/b2", note: "Independent server. A does not import it." },
] as const;
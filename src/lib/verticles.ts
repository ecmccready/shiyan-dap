export type Vertical = {
  id: string;
  label: string;
  asset: string;
  href: string;
  firstY: "settlement" | "acquisition" | "audience_response" | "conversion" | "revenue" | "retention";
  actions: string[];
};

export const VERTICALS: Vertical[] = [
  { id: "music", label: "Music", asset: "song", href: "/", firstY: "settlement", actions: ["INITIATE_TRADE", "playlist_push", "release"] },
  { id: "safety", label: "Diagnostic Safety", asset: "case", href: "/workbench/safety", firstY: "retention", actions: ["HOLD", "CLINICIAN_REVIEW", "ESCALATE"] },
  { id: "ai-content", label: "AI Content", asset: "model", href: "/", firstY: "acquisition", actions: ["INITIATE_TRADE", "license", "release"] },
  { id: "animation", label: "Animation", asset: "clip", href: "/", firstY: "audience_response", actions: ["INITIATE_TRADE", "premiere", "release"] },
  { id: "games", label: "Games", asset: "title", href: "/", firstY: "conversion", actions: ["INITIATE_TRADE", "playtest", "release"] },
  { id: "esports", label: "eSports", asset: "event", href: "/", firstY: "audience_response", actions: ["INITIATE_TRADE", "broadcast", "release"] },
  { id: "real-estate", label: "Real Estate", asset: "listing", href: "/", firstY: "conversion", actions: ["INITIATE_TRADE", "showing", "close"] },
];

export const AGENT_A = "Agent A · ECMcCready";
export const AGENT_B = "Agent B · this session";

const KEY = "shiyan-vertical";

export function readVertical() {
  if (typeof window === "undefined") return "music";
  return window.localStorage.getItem(KEY) || "music";
}

export function writeVertical(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, id);
}

export function hrefForVertical(id: string) {
  return VERTICALS.find((v) => v.id === id)?.href || "/";
}

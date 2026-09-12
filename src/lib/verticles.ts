export type Vertical = {
  id: string;
  label: string;
  asset: string;
  firstY: "settlement" | "acquisition" | "audience_response" | "conversion" | "revenue" | "retention";
  actions: string[];
};

export const VERTICALS: Vertical[] = [
  { id: "music", label: "Music", asset: "song", firstY: "settlement", actions: ["INITIATE_TRADE", "playlist_push", "release"] },
  { id: "ai-content", label: "AI Content", asset: "model", firstY: "acquisition", actions: ["INITIATE_TRADE", "license", "release"] },
  { id: "animation", label: "Animation", asset: "clip", firstY: "audience_response", actions: ["INITIATE_TRADE", "premiere", "release"] },
  { id: "games", label: "Games", asset: "title", firstY: "conversion", actions: ["INITIATE_TRADE", "playtest", "release"] },
  { id: "esports", label: "eSports", asset: "event", firstY: "audience_response", actions: ["INITIATE_TRADE", "broadcast", "release"] },
  { id: "real-estate", label: "Real Estate", asset: "listing", firstY: "conversion", actions: ["INITIATE_TRADE", "showing", "close"] },
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
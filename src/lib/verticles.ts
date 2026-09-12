export type Vertical = {
  id: string;
  label: string;
  asset: string;
  firstY: keyof typeof emptyY;
  actions: string[];
};

export const emptyY = {
  settlement: 0,
  acquisition: 0,
  audience_response: 0,
  conversion: 0,
  revenue: 0,
  retention: 0,
};

export const VERTICALS: Vertical[] = [
  { id: "music", label: "Music", asset: "Single / playlist", firstY: "settlement", actions: ["INITIATE_TRADE", "playlist_push", "release"] },
  { id: "video", label: "Video", asset: "Cut / channel", firstY: "audience_response", actions: ["publish_cut", "thumbnail_change"] },
  { id: "writing", label: "Writing", asset: "Essay / issue", firstY: "conversion", actions: ["publish_issue", "paywall"] },
  { id: "visual", label: "Visual", asset: "Drop / edition", firstY: "settlement", actions: ["list_edition", "INITIATE_TRADE"] },
  { id: "live", label: "Live", asset: "Show / ticket", firstY: "revenue", actions: ["announce_date", "ticket_drop"] },
  { id: "education", label: "Education", asset: "Course / cohort", firstY: "retention", actions: ["open_cohort", "lesson_push"] },
  { id: "brand", label: "Brand", asset: "Campaign / SKU", firstY: "conversion", actions: ["launch_sku", "ad_push"] },
  { id: "agency", label: "Agency", asset: "Client / brief", firstY: "revenue", actions: ["accept_brief", "deliver"] },
];

export const AGENT_A = "Agent A · ECMcCready";
export const AGENT_B = "Agent B · this session";
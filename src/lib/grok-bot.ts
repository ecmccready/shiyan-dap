export interface BotContext {
  message: string;
  clusterId?: string;
  domain?: string;
  userId?: string;
}

export interface BotResponse {
  reply: string;
  mode: "simulated" | "live";
  suggestedActions?: string[];
  clusterId?: string;
  confidence: number;
}

export async function runGrokBot(
  context: BotContext,
  mode: "simulated" | "live" = "simulated"
): Promise<BotResponse> {
  const lower = String(context.message || "").toLowerCase();

  if (
    lower.includes("acquire") ||
    lower.includes("transmedia") ||
    lower.includes("retain") ||
    lower.includes("marketplace") ||
    lower.includes("transfer") ||
    lower.includes("playlist") ||
    lower.includes("settle")
  ) {
    return {
      reply:
        "x acquires on Social Transmedia. y retains in the Marketplace. z transfers on the Playlist rail. I can Buy, Sell, or Trade without making the user touch the chain.",
      mode,
      suggestedActions: ["Acquire", "Retain", "Transfer", "Buy"],
      clusterId: context.clusterId,
      confidence: 0.93,
    };
  }

  if (
    lower.includes("refine") ||
    lower.includes("analyze") ||
    lower.includes("deep") ||
    lower.includes("hy4") ||
    lower.includes("attention")
  ) {
    return {
      reply:
        "Deep path engaged. I’m comparing Grok with Hy4 on this cluster and feeding the disagreement into Attention so the next token can mint from a stronger signal.",
      mode,
      suggestedActions: ["Show Disagreement", "View Cluster", "Buy"],
      clusterId: context.clusterId,
      confidence: 0.91,
    };
  }

  if (lower.includes("buy")) {
    return {
      reply:
        "I can help you Buy into this cluster. In simulated mode I’m confirming the intent. Ready to prepare a Buy container.",
      mode,
      suggestedActions: ["Confirm Buy", "View Cluster", "Check Balance"],
      clusterId: context.clusterId,
      confidence: 0.9,
    };
  }

  if (lower.includes("sell")) {
    return {
      reply:
        "Sell is available on the Marketplace retention layer. I can prepare a Sell container while you keep ownership of the source data.",
      mode,
      suggestedActions: ["Confirm Sell", "View Cluster", "Check Balance"],
      clusterId: context.clusterId,
      confidence: 0.9,
    };
  }

  if (lower.includes("trade")) {
    return {
      reply:
        "Trade moves value across domains on the Playlist settlement rail. I can prepare a Trade container now.",
      mode,
      suggestedActions: ["Confirm Trade", "Open Playlist", "Check Balance"],
      clusterId: context.clusterId,
      confidence: 0.9,
    };
  }

  if (lower.includes("explore") || lower.includes("cluster")) {
    return {
      reply:
        "I can explore current clusters and route you to acquire, retain, or transfer. Music remains the cash-flow domain.",
      mode,
      suggestedActions: ["Acquire", "Retain", "Transfer", "Buy"],
      clusterId: context.clusterId,
      confidence: 0.88,
    };
  }

  return {
    reply:
      "I’m the Grok Bot sitting on top of your Clusters. I can help you Explore, Buy, Sell, or Trade Music and AI content. What would you like to do?",
    mode,
    suggestedActions: ["Explore Clusters", "Buy", "Sell", "Trade"],
    clusterId: context.clusterId,
    confidence: 0.86,
  };
}
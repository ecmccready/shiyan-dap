export type BotMode = "simulated" | "grok";

export interface BotContext {
  clusterId?: string;
  domain?: string;
  userId?: string;
  action?: "buy" | "sell" | "trade" | "explore" | "explain";
  message: string;
}

export interface BotResponse {
  reply: string;
  mode: BotMode;
  suggestedActions?: string[];
  clusterId?: string;
  confidence: number;
}

/**
 * Portable Grok Bot
 * Sits on top of Clusters and supports Buy / Sell / Trade containers.
 * Currently runs in simulated mode. Real Grok integration can be swapped in later.
 */
export async function runGrokBot(
  context: BotContext,
  mode: BotMode = "simulated"
): Promise<BotResponse> {
  // ----- SIMULATED BOT (always available) -----
  if (mode === "simulated") {
    const lower = context.message.toLowerCase();

    if (lower.includes("buy")) {
      return {
        reply: `I can help you Buy into this cluster${context.clusterId ? ` (${context.clusterId})` : ""}. In simulated mode I’m confirming the intent. Ready to prepare a Buy container.`,
        mode: "simulated",
        suggestedActions: ["Confirm Buy", "View Cluster", "Check Balance"],
        clusterId: context.clusterId,
        confidence: 0.88,
      };
    }

    if (lower.includes("sell")) {
      return {
        reply: `Sell request noted for cluster${context.clusterId ? ` ${context.clusterId}` : ""}. I can prepare the Sell container and show you the current implied value.`,
        mode: "simulated",
        suggestedActions: ["Confirm Sell", "View Valuation", "Cancel"],
        clusterId: context.clusterId,
        confidence: 0.87,
      };
    }

    if (lower.includes("trade")) {
      return {
        reply: `Trade intent received. I can help you swap value between clusters or domains while keeping ownership clear.`,
        mode: "simulated",
        suggestedActions: ["Start Trade", "View Open Clusters", "Explain Terms"],
        clusterId: context.clusterId,
        confidence: 0.86,
      };
    }

    return {
      reply: `I’m the Grok Bot sitting on top of your Clusters. I can help you explore, Buy, Sell, or Trade. What would you like to do?`,
      mode: "simulated",
      suggestedActions: ["Explore Clusters", "Buy", "Sell", "Trade"],
      clusterId: context.clusterId,
      confidence: 0.9,
    };
  }

  // ----- REAL GROK MODE (stubbed for now) -----
  return {
    reply: "Real Grok Bot mode is not yet active. Falling back to simulated response.",
    mode: "simulated",
    suggestedActions: ["Try again in simulated mode"],
    confidence: 0.5,
  };
}
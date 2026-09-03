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
    lower.includes("pay") ||
    lower.includes("engine") ||
    lower.includes("advert") ||
    lower.includes("ad pay")
  ) {
    return {
      reply:
        "Ads pay both sides: 70% to the user, 30% to the engine. Fiat is the root. Crypto is later. I route that split through the Playlist rail so the creator is paid without touching the chain.",
      mode,
      suggestedActions: ["Pay User", "Pay Engine", "Open Marketplace", "Buy"],
      clusterId: context.clusterId,
      confidence: 0.94,
    };
  }

  if (
    lower.includes("b2b") ||
    lower.includes("b2c") ||
    lower.includes("c2c") ||
    lower.includes("contain")
  ) {
    return {
      reply:
        "C2C writes the Home. Marketplace contains that Home as B2C inventory. Settle promotes it to B2B. Grok handles the fast path. Hy4 stays on the deep path until HY4_API_URL exists.",
      mode,
      suggestedActions: ["Contain Home", "Promote B2B", "Transfer", "Buy"],
      clusterId: context.clusterId,
      confidence: 0.93,
    };
  }

  if (lower.includes("upload") || lower.includes("audio") || lower.includes("master")) {
    return {
      reply:
        "Upload is the file door. Attach the master when Cubase or Guitar Pro is ready. The First Single can sell before the file exists. I will keep Fast Grok on chat and Deep Hy4 on mint-quality work.",
      mode,
      suggestedActions: ["Open Upload", "Open Single", "B2B", "Buy"],
      clusterId: context.clusterId,
      confidence: 0.92,
    };
  }

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
        "Deep path engaged. Grok and Hy4 compare on this cluster. Disagreement writes Attention. The next token can mint from a stronger signal.",
      mode,
      suggestedActions: ["Show Disagreement", "View Cluster", "Buy"],
      clusterId: context.clusterId,
      confidence: 0.91,
    };
  }

  if (lower.includes("buy")) {
    return {
      reply:
        "Buy is ready on the fiat root. I can prepare a Buy container now. Crypto remains the later dedicated-app rail.",
      mode,
      suggestedActions: ["Confirm Buy", "Pay User", "Check Balance"],
      clusterId: context.clusterId,
      confidence: 0.9,
    };
  }

  if (lower.includes("sell")) {
    return {
      reply:
        "Sell stays on Marketplace retention. You keep the source data. The engine can still take its ad share.",
      mode,
      suggestedActions: ["Confirm Sell", "Pay Engine", "Check Balance"],
      clusterId: context.clusterId,
      confidence: 0.9,
    };
  }

  if (lower.includes("trade")) {
    return {
      reply:
        "Trade moves value across domains on the Playlist settlement rail. C2C can become B2B when the cluster settles.",
      mode,
      suggestedActions: ["Confirm Trade", "Promote B2B", "Open Playlist"],
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
      "I’m the Grok Bot sitting on top of your Clusters. I orchestrate Fast Grok and Deep Hy4, pay user and engine from ads, and route C2C into B2B through the Playlist rail.",
    mode,
    suggestedActions: ["Pay User", "B2B", "Upload", "Buy"],
    clusterId: context.clusterId,
    confidence: 0.88,
  };
}
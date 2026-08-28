import { NextResponse } from "next/server";
import { runGrokBot } from "@/lib/grok-bot";
import { getMarketplaceInventory } from "@/lib/marketplace";
import {
  createToken,
  executeTokenAction,
  getAllTokens,
} from "@/lib/token";
import { routeModels, RoutePath } from "@/lib/router";

function choosePath(message: string): RoutePath {
  const lower = message.toLowerCase();
  const deepHints = [
    "refine",
    "analyze",
    "compare",
    "improve",
    "mint",
    "cluster",
    "attention",
    "hy4",
    "deep",
  ];
  return deepHints.some((word) => lower.includes(word)) ? "deep" : "fast";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, clusterId, domain, userId, mode } = body;

    if (!message) {
      return NextResponse.json(
        { success: false, error: "message is required" },
        { status: 400 }
      );
    }

    const lower = String(message).toLowerCase();
    const path = choosePath(message);
    const inventory = getMarketplaceInventory(domain);
    const tokens = getAllTokens();

    let token = tokens[0];
    if (!token) {
      token = createToken({
        symbol: "SYSH",
        name: "Shiyan Yishu Token",
        domain: domain || "music",
        owner: userId || "ECMcCready",
        initialSupply: 1000,
        price: 1.5,
      });
    }

    let transaction = null;
    if (lower.includes("buy")) {
      transaction = executeTokenAction({
        tokenId: token.id,
        action: "buy",
        from: "Marketplace",
        to: userId || "ECMcCready",
        amount: 10,
      });
    } else if (lower.includes("sell")) {
      transaction = executeTokenAction({
        tokenId: token.id,
        action: "sell",
        from: userId || "ECMcCready",
        to: "Marketplace",
        amount: 10,
      });
    } else if (lower.includes("trade")) {
      transaction = executeTokenAction({
        tokenId: token.id,
        action: "trade",
        from: userId || "ECMcCready",
        to: "Marketplace",
        amount: 10,
      });
    }

    const routed = await routeModels(message, path);

    const clusterSummary =
      inventory.length > 0
        ? inventory
            .slice(0, 5)
            .map(
              (c) =>
                `${c.name} (${c.domain}, π_inv: ${c.pi_inv}, status: ${c.status})`
            )
            .join(" | ")
        : "No clusters currently in inventory.";

    const enrichedMessage = `${message}

[Route: ${path}]
[Primary: ${routed.primary.provider}]
[Secondary: ${routed.secondary?.provider || "none"}]
[Disagreement: ${routed.disagreement}]

[Current Cluster Inventory Context]
${clusterSummary}

${
  transaction
    ? `[Executed ${transaction.action.toUpperCase()}] ${transaction.amount} tokens for $${transaction.total}.`
    : ""
}`;

    const response = await runGrokBot(
      {
        message: enrichedMessage,
        clusterId,
        domain,
        userId,
      },
      mode || "simulated"
    );

    return NextResponse.json({
      success: true,
      ...response,
      path,
      disagreement: routed.disagreement,
      secondaryProvider: routed.secondary?.provider || null,
      availableClusters: inventory.length,
      transaction,
    });
  } catch (error) {
    console.error("Bot error:", error);
    return NextResponse.json(
      { success: false, error: "Bot failed to respond" },
      { status: 500 }
    );
  }
}
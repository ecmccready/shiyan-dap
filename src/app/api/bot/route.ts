import { NextResponse } from "next/server";
import { runGrokBot } from "@/lib/grok-bot";
import { getMarketplaceInventory } from "@/lib/marketplace";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, clusterId, domain, userId, action, mode } = body;

    if (!message) {
      return NextResponse.json(
        { success: false, error: "message is required" },
        { status: 400 }
      );
    }

    // Pull live clusters so the Bot has real context
    const inventory = getMarketplaceInventory(domain);
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

    // Enrich the message with live cluster context
    const enrichedMessage = `${message}

[Current Cluster Inventory Context]
${clusterSummary}`;

    const response = await runGrokBot(
      {
        message: enrichedMessage,
        clusterId,
        domain,
        userId,
        action,
      },
      mode || "simulated"
    );

    return NextResponse.json({
      success: true,
      ...response,
      availableClusters: inventory.length,
    });
  } catch (error) {
    console.error("Bot error:", error);
    return NextResponse.json(
      { success: false, error: "Bot failed to respond" },
      { status: 500 }
    );
  }
}
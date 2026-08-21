import { NextResponse } from "next/server";
import {
  createToken,
  executeTokenAction,
  getAllTokens,
  getTokensByDomain,
  getTokenTransactions,
} from "../../../lib/token";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain");
  const tokenId = searchParams.get("tokenId");

  if (tokenId) {
    const txs = getTokenTransactions(tokenId);
    return NextResponse.json({ success: true, transactions: txs });
  }

  const tokens = domain ? getTokensByDomain(domain) : getAllTokens();

  return NextResponse.json({
    success: true,
    count: tokens.length,
    tokens,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    // Create a new token
    if (action === "create") {
      const token = createToken({
        symbol: body.symbol,
        name: body.name,
        domain: body.domain,
        owner: body.owner,
        initialSupply: body.initialSupply,
        price: body.price,
      });

      return NextResponse.json({ success: true, token });
    }

    // Buy / Sell / Trade
    if (["buy", "sell", "trade"].includes(action)) {
      const tx = executeTokenAction({
        tokenId: body.tokenId,
        action,
        from: body.from,
        to: body.to,
        amount: body.amount,
      });

      if (!tx) {
        return NextResponse.json(
          { success: false, error: "Transaction failed (insufficient balance or invalid token)" },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true, transaction: tx });
    }

    return NextResponse.json(
      { success: false, error: "Unknown action" },
      { status: 400 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "Token operation failed" },
      { status: 500 }
    );
  }
}
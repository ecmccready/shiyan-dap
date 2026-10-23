import { NextResponse } from "next/server";
import {
  createToken,
  executeTokenAction,
  getAllTokens,
  getTokensByDomain,
  getTokenTransactions,
} from "../../../lib/token";

const MAX_TOKEN_ID_LENGTH = 128;
const MAX_TOKEN_LABEL_LENGTH = 200;
const MAX_DOMAIN_LENGTH = 100;

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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { success: false, error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }
  const payload = body as Record<string, unknown>;

  try {
    if (payload.action === "create") {
      if (
        typeof payload.symbol !== "string" ||
        !payload.symbol.trim() ||
        payload.symbol.length > MAX_TOKEN_LABEL_LENGTH ||
        typeof payload.name !== "string" ||
        !payload.name.trim() ||
        payload.name.length > MAX_TOKEN_LABEL_LENGTH ||
        typeof payload.domain !== "string" ||
        !payload.domain.trim() ||
        payload.domain.length > MAX_DOMAIN_LENGTH ||
        typeof payload.owner !== "string" ||
        !payload.owner.trim() ||
        payload.owner.length > MAX_TOKEN_LABEL_LENGTH ||
        (payload.initialSupply !== undefined &&
          (typeof payload.initialSupply !== "number" ||
            !Number.isSafeInteger(payload.initialSupply) ||
            payload.initialSupply <= 0)) ||
        (payload.price !== undefined &&
          (typeof payload.price !== "number" ||
            !Number.isFinite(payload.price) ||
            payload.price <= 0))
      ) {
        return NextResponse.json(
          { success: false, error: "Invalid token creation fields" },
          { status: 400 }
        );
      }
      const token = createToken({
        symbol: payload.symbol,
        name: payload.name,
        domain: payload.domain,
        owner: payload.owner,
        initialSupply: payload.initialSupply,
        price: payload.price,
      });

      return NextResponse.json({ success: true, token });
    }

    if (
      payload.action === "buy" ||
      payload.action === "sell" ||
      payload.action === "trade"
    ) {
      if (
        typeof payload.tokenId !== "string" ||
        !payload.tokenId ||
        payload.tokenId.length > MAX_TOKEN_ID_LENGTH ||
        typeof payload.from !== "string" ||
        !payload.from.trim() ||
        payload.from.length > MAX_TOKEN_LABEL_LENGTH ||
        typeof payload.to !== "string" ||
        !payload.to.trim() ||
        payload.to.length > MAX_TOKEN_LABEL_LENGTH ||
        typeof payload.amount !== "number" ||
        !Number.isFinite(payload.amount) ||
        payload.amount <= 0
      ) {
        return NextResponse.json(
          { success: false, error: "Invalid token transaction fields" },
          { status: 400 }
        );
      }
      const tx = executeTokenAction({
        tokenId: payload.tokenId,
        action: payload.action,
        from: payload.from,
        to: payload.to,
        amount: payload.amount,
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
    console.error("Token operation failed:", error);
    return NextResponse.json(
      { success: false, error: "Token operation failed" },
      { status: 500 }
    );
  }
}
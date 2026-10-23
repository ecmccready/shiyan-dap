import { NextResponse } from "next/server";

// Temporary in-file store (avoids the module resolution issue)
interface StoredNFT {
  id: string;
  metadata: unknown;
  mintedAt: string;
  owner: string;
  clusterId: string;
  status: "simulated" | "minted";
}

const nfts: StoredNFT[] = [];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner");

  const result = owner
    ? nfts.filter((n) => n.owner === owner)
    : [...nfts];

  return NextResponse.json({
    success: true,
    count: result.length,
    nfts: result,
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
  const metadata = payload.metadata;
  const owner = payload.owner;
  const clusterId = payload.clusterId;
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    Array.isArray(metadata) ||
    typeof owner !== "string" ||
    !owner.trim() ||
    typeof clusterId !== "string" ||
    !clusterId.trim()
  ) {
    return NextResponse.json(
      { success: false, error: "Valid metadata, owner, and clusterId are required" },
      { status: 400 }
    );
  }
  const nft: StoredNFT = {
    id: `nft_${clusterId}_${Date.now()}`,
    metadata,
    mintedAt: new Date().toISOString(),
    owner,
    clusterId,
    status: "simulated",
  };

  const exists = nfts.findIndex((n) => n.clusterId === clusterId);
  if (exists >= 0) {
    nfts[exists] = nft;
  } else {
    nfts.push(nft);
  }

  return NextResponse.json({
    success: true,
    nft,
  });
}
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
  try {
    const body = (await request.json()) as {
      metadata?: unknown;
      owner?: unknown;
      clusterId?: unknown;
    };
    const { metadata, owner, clusterId } = body;

    if (
      !metadata ||
      typeof owner !== "string" ||
      !owner ||
      typeof clusterId !== "string" ||
      !clusterId
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
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

    // Replace if already exists for this cluster
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
  } catch (error) {
    console.error("Failed to save NFT:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save NFT" },
      { status: 500 }
    );
  }
}
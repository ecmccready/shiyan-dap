import { NextResponse } from "next/server";

// Temporary in-file store (avoids the module resolution issue)
interface StoredNFT {
  id: string;
  metadata: any;
  mintedAt: string;
  owner: string;
  clusterId: string;
  status: "simulated" | "minted";
}

let nfts: StoredNFT[] = [];

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
    const body = await request.json();
    const { metadata, owner, clusterId } = body;

    if (!metadata || !owner || !clusterId) {
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
    console.error(error);
    return NextResponse.json(
      { success: false, error: "Failed to save NFT" },
      { status: 500 }
    );
  }
}
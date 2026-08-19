import { NextResponse } from "next/server";
import { saveNFT, getAllNFTs, getNFTsByOwner } from "@/lib/nft-store";
import { ClusterNFTMetadata } from "@/lib/nft";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner");

  const nfts = owner ? getNFTsByOwner(owner) : getAllNFTs();

  return NextResponse.json({
    success: true,
    count: nfts.length,
    nfts,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { metadata, owner, clusterId } = body as {
      metadata: ClusterNFTMetadata;
      owner: string;
      clusterId: string;
    };

    if (!metadata || !owner || !clusterId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const nft = {
      id: `nft_${clusterId}_${Date.now()}`,
      metadata,
      mintedAt: new Date().toISOString(),
      owner,
      clusterId,
      status: "simulated" as const,
    };

    saveNFT(nft);

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
import { ClusterNFTMetadata } from "./nft";

export type Chain = "simulated" | "base" | "polygon" | "solana" | "ethereum";

export interface MintRequest {
  metadata: ClusterNFTMetadata;
  owner: string;
  clusterId: string;
  chain?: Chain;
}

export interface MintResult {
  success: boolean;
  chain: Chain;
  tokenId?: string;
  transactionHash?: string;
  contractAddress?: string;
  metadataUri?: string;
  message: string;
  raw?: any;
}

/**
 * Minting Service
 * Currently only supports simulated minting.
 * Real chain implementations will be added here later.
 */
export async function mintNFT(request: MintRequest): Promise<MintResult> {
  const chain = request.chain || "simulated";

  // ----- SIMULATED MINT (current default) -----
  if (chain === "simulated") {
    const tokenId = `sim_${request.clusterId}_${Date.now()}`;

    return {
      success: true,
      chain: "simulated",
      tokenId,
      transactionHash: `0xsim_${Date.now().toString(16)}`,
      contractAddress: "0xSimulatedClusterNFT",
      metadataUri: `https://shiyanyishu.com/api/metadata/${tokenId}`, // placeholder
      message: "NFT minted successfully (simulated)",
      raw: {
        metadata: request.metadata,
        owner: request.owner,
      },
    };
  }

  // ----- FUTURE REAL CHAINS -----
  if (chain === "base" || chain === "polygon" || chain === "solana" || chain === "ethereum") {
    return {
      success: false,
      chain,
      message: `Real minting on ${chain} is not yet implemented. Use "simulated" for now.`,
    };
  }

  return {
    success: false,
    chain: "simulated",
    message: "Unknown chain",
  };
}
import { ClusterNFTMetadata } from "./nft";

export interface StoredNFT {
  id: string;
  metadata: ClusterNFTMetadata;
  mintedAt: string;
  owner: string;
  clusterId: string;
  status: "simulated" | "minted";
}

// Simple in-memory store (resets on server restart)
// Later this can be replaced with a database
let nfts: StoredNFT[] = [];

export function saveNFT(nft: StoredNFT) {
  // Avoid duplicates by clusterId
  const exists = nfts.find((n) => n.clusterId === nft.clusterId);
  if (exists) {
    nfts = nfts.map((n) =>
      n.clusterId === nft.clusterId ? { ...nft } : n
    );
  } else {
    nfts.push(nft);
  }
}

export function getAllNFTs(): StoredNFT[] {
  return [...nfts];
}

export function getNFTsByOwner(owner: string): StoredNFT[] {
  return nfts.filter((n) => n.owner === owner);
}

export function getNFTByClusterId(clusterId: string): StoredNFT | undefined {
  return nfts.find((n) => n.clusterId === clusterId);
}
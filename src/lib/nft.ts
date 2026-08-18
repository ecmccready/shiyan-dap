/**
 * Shiyan Yishu – Cluster NFT Metadata Standard
 * Version 0.1
 *
 * This structure is designed to be compatible with
 * common NFT metadata standards (OpenSea, Metaplex, etc.)
 * while carrying the full GTP / Missing Middle context.
 */

export interface ClusterNFTAttribute {
  trait_type: string;
  value: string | number;
}

export interface ClusterNFTMetadata {
  // Standard fields
  name: string;
  description: string;
  image?: string; // future: generated cover art
  external_url?: string;

  // Core Shiyan Yishu fields
  animation_url?: string;
  background_color?: string;

  attributes: ClusterNFTAttribute[];

  // Custom properties (for our protocol)
  properties: {
    protocol: "Shiyan Yishu GTP";
    version: string;
    domain: string;
    cluster_id: string;
    owner: string;
    pi_inv: number;
    similarity: number;
    status: "available" | "reserved" | "settled";
    tags: string[];
    created_at: string;
    settled_at?: string;
    artist_payout?: number;
    simulated_revenue?: number;
  };
}

/**
 * Helper: Convert a MarketCluster into NFT metadata
 */
export function clusterToNFTMetadata(cluster: {
  id: string;
  name: string;
  domain: string;
  size: number;
  tags: string[];
  similarity: number;
  pi_inv: number;
  status: string;
  owner: string;
  createdAt: string;
  settledAt?: string;
  artistPayout?: number;
  simulatedRevenue?: number;
}): ClusterNFTMetadata {
  return {
    name: cluster.name,
    description: `Living cluster from the Shiyan Yishu Missing Middle Marketplace. Domain: ${cluster.domain}. This NFT represents ownership rights and future revenue participation in the cluster.`,
    external_url: `https://shiyanyishu.com/marketplace/${cluster.id}`, // placeholder
    attributes: [
      { trait_type: "Domain", value: cluster.domain },
      { trait_type: "Status", value: cluster.status },
      { trait_type: "π_inv", value: cluster.pi_inv },
      { trait_type: "Similarity", value: cluster.similarity },
      { trait_type: "Size", value: cluster.size },
      { trait_type: "Owner", value: cluster.owner },
      ...cluster.tags.map((tag) => ({
        trait_type: "Tag",
        value: tag,
      })),
    ],
    properties: {
      protocol: "Shiyan Yishu GTP",
      version: "0.4",
      domain: cluster.domain,
      cluster_id: cluster.id,
      owner: cluster.owner,
      pi_inv: cluster.pi_inv,
      similarity: cluster.similarity,
      status: cluster.status as any,
      tags: cluster.tags,
      created_at: cluster.createdAt,
      settled_at: cluster.settledAt,
      artist_payout: cluster.artistPayout,
      simulated_revenue: cluster.simulatedRevenue,
    },
  };
}
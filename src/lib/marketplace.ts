export interface MarketCluster {
  id: string;
  name: string;
  domain: string;
  size: number;
  tags: string[];
  similarity: number;
  pi_inv: number;
  status: "available" | "reserved" | "settled";
  owner: string;
  createdAt: string;
  lastUpdated: string;
}

// Simple in-memory marketplace inventory
let inventory: MarketCluster[] = [];

export function addClusterToMarketplace(cluster: MarketCluster) {
  // Avoid duplicates
  const exists = inventory.find((c) => c.id === cluster.id);
  if (!exists) {
    inventory.push(cluster);
  } else {
    // Update existing
    inventory = inventory.map((c) =>
      c.id === cluster.id ? { ...c, ...cluster, lastUpdated: new Date().toISOString() } : c
    );
  }
}

export function getMarketplaceInventory(domain?: string): MarketCluster[] {
  if (domain) {
    return inventory.filter((c) => c.domain.toLowerCase().includes(domain.toLowerCase()));
  }
  return [...inventory];
}

export function getClusterById(id: string): MarketCluster | undefined {
  return inventory.find((c) => c.id === id);
}

export function updateClusterStatus(id: string, status: MarketCluster["status"]) {
  inventory = inventory.map((c) =>
    c.id === id
      ? { ...c, status, lastUpdated: new Date().toISOString() }
      : c
  );
}
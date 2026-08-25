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
  // New fields for settlement
  simulatedRevenue?: number;
  artistShare?: number;
  artistPayout?: number;
  settledAt?: string;
}

// Simple in-memory marketplace inventory
let inventory: MarketCluster[] = [];

export function clearInventory() {
  inventory.length = 0;
}

export function addClusterToMarketplace(cluster: MarketCluster) {
  const exists = inventory.find((c) => c.id === cluster.id);
  if (!exists) {
    inventory.push(cluster);
  } else {
    inventory = inventory.map((c) =>
      c.id === cluster.id
        ? { ...c, ...cluster, lastUpdated: new Date().toISOString() }
        : c
    );
  }
}

export function getMarketplaceInventory(domain?: string): MarketCluster[] {
  if (domain) {
    return inventory.filter((c) =>
      c.domain.toLowerCase().includes(domain.toLowerCase())
    );
  }
  return [...inventory];
}

export function getClusterById(id: string): MarketCluster | undefined {
  return inventory.find((c) => c.id === id);
}

export function updateClusterStatus(
  id: string,
  status: MarketCluster["status"]
) {
  inventory = inventory.map((c) => {
    if (c.id !== id) return c;

    const updated: MarketCluster = {
      ...c,
      status,
      lastUpdated: new Date().toISOString(),
    };

    // When settling, attach a simulated payout
    if (status === "settled") {
      const revenue = 42; // base simulated revenue
      const share = 0.7; // 70% artist share
      updated.simulatedRevenue = revenue;
      updated.artistShare = share;
      updated.artistPayout = Number((revenue * share).toFixed(2));
      updated.settledAt = new Date().toISOString();
    }

    // When resetting, clear settlement data
    if (status === "available") {
      updated.simulatedRevenue = undefined;
      updated.artistShare = undefined;
      updated.artistPayout = undefined;
      updated.settledAt = undefined;
    }

    return updated;
  });
}
import { persistGet, persistPut } from "@/lib/persist";
import fs from "node:fs";
import path from "node:path";
import { AdPayout, ContainedHome, promoteLayer } from "@/lib/economy";

export interface MarketplaceCluster {
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
  layer?: ContainedHome["layer"];
  containedHome?: ContainedHome;
  adPayout?: AdPayout;
  artistPayout?: number;
  [key: string]: unknown;
}

const file = path.join(process.cwd(), "src/data/marketplace.json");
const g = globalThis as typeof globalThis & {
  __shiyanMarketplace?: MarketplaceCluster[];
  __shiyanMarketplaceLoad?: Promise<MarketplaceCluster[]>;
};

function readDisk(): MarketplaceCluster[] | null {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeDisk(inventory: MarketplaceCluster[]) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(inventory, null, 2));
  } catch {
    // Vercel is read-only; warm memory still holds.
  }
}

async function loadInventory(): Promise<MarketplaceCluster[]> {
  if (g.__shiyanMarketplace) return g.__shiyanMarketplace;
  if (!g.__shiyanMarketplaceLoad) {
    g.__shiyanMarketplaceLoad = persistGet<MarketplaceCluster[]>(
      "marketplace.json"
    )
      .then((persisted) => {
        const inventory = persisted ?? readDisk() ?? [];
        g.__shiyanMarketplace = inventory;
        return inventory;
      })
      .finally(() => {
        g.__shiyanMarketplaceLoad = undefined;
      });
  }
  return g.__shiyanMarketplaceLoad;
}

async function save(inventory: MarketplaceCluster[]) {
  g.__shiyanMarketplace = inventory;
  writeDisk(inventory);
  await persistPut("marketplace.json", inventory);
}

export async function getInventory(domain?: string) {
  const inventory = await loadInventory();
  return domain
    ? inventory.filter((cluster) => cluster.domain === domain)
    : inventory;
}

export async function addClusterToMarketplace(cluster: MarketplaceCluster) {
  const inventory = await loadInventory();
  const exists = inventory.some((item) => item.id === cluster.id);
  if (!exists) {
    inventory.unshift(cluster);
    await save(inventory);
  }
  return cluster;
}

export async function updateClusterStatus(
  id: string,
  status: MarketplaceCluster["status"]
) {
  const inventory = await loadInventory();
  const cluster = inventory.find((item) => item.id === id);
  if (!cluster) return null;

  cluster.status = status;
  cluster.lastUpdated = new Date().toISOString();
  cluster.layer = promoteLayer(status);
  cluster.containedHome = {
    ...(cluster.containedHome || {
      href: `/home?cluster=${id}`,
      owner: cluster.owner,
      clusterId: id,
    }),
    layer: cluster.layer,
  };

  if (status === "settled") {
    cluster.artistPayout =
      cluster.adPayout?.userPayout ?? Number((cluster.similarity * 10).toFixed(2));
  }

  await save(inventory);
  return cluster;
}

export async function clearInventory() {
  await save([]);
  return [];
}

export const updateStatus = updateClusterStatus;
export const setClusterStatus = updateClusterStatus;
export const getMarketplaceInventory = getInventory;
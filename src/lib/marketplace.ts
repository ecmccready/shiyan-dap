import { persistPut } from "@/lib/persist";
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

function store(): MarketplaceCluster[] {
  const inventory = g.__shiyanMarketplace ?? readDisk() ?? [];
  g.__shiyanMarketplace = inventory;
  return inventory;
}

function save(inventory: MarketplaceCluster[]) {
  g.__shiyanMarketplace = inventory;
  writeDisk(inventory);
  void persistPut("marketplace.json", inventory);
}

export function getInventory(domain?: string) {
  const inventory = store();
  return domain
    ? inventory.filter((cluster) => cluster.domain === domain)
    : inventory;
}

export function addClusterToMarketplace(cluster: MarketplaceCluster) {
  const inventory = store();
  const exists = inventory.some((item) => item.id === cluster.id);
  if (!exists) {
    inventory.unshift(cluster);
    save(inventory);
  }
  return cluster;
}

export function updateClusterStatus(id: string, status: MarketplaceCluster["status"]) {
  const inventory = store();
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

  save(inventory);
  return cluster;
}

export function clearInventory() {
  save([]);
  return [];
}

export const updateStatus = updateClusterStatus;
export const setClusterStatus = updateClusterStatus;
export const getMarketplaceInventory = getInventory;
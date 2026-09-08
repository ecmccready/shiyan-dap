export const FIRST_SINGLE_URL = "https://www.ecmccready.com/songs";

export const proofSingle = {
  id: "cl_shiyan_yishu_001",
  name: "Shiyan Yishu — First Single",
  domain: "music",
  size: 1,
  tags: ["first-single", "independent", "generative", "owned-asset"],
  similarity: 1,
  pi_inv: 1,
  status: "available",
  owner: "ECMcCready",
  createdAt: "2026-09-01T00:00:00.000Z",
  lastUpdated: "2026-09-08T00:00:00.000Z",
  assetUrl: FIRST_SINGLE_URL,
  containedHome: { href: "/home", owner: "ECMcCready", layer: "C2C" },
  layer: "C2C",
  emergence: { x: 1, y: 1, z: 2, formula: "y,x + y,x = z" },
};

export const proofPlaylist = {
  id: "pl_label_001",
  name: "Shiyan Yishu Label Playlist",
  owner: "ECMcCready",
  domain: "music",
  clusterIds: ["cl_shiyan_yishu_001"],
  productType: "sync",
  license: "sync",
  attribution: [{ owner: "ECMcCready", share: 1 }],
  b2bReady: true,
  createdAt: "2026-09-01T00:00:00.000Z",
  assetUrl: FIRST_SINGLE_URL,
};

export const proofInventory = [proofSingle];
export const proofPlaylists = [proofPlaylist];

export function mergeInventory(live: any[] | undefined) {
  const rows = Array.isArray(live) ? live : [];
  if (rows.some((row) => row?.id === proofSingle.id || String(row?.name || "").includes("Shiyan Yishu"))) return rows;
  return [proofSingle, ...rows];
}

export function mergePlaylists(live: any[] | undefined) {
  const rows = Array.isArray(live) ? live : [];
  if (rows.some((row) => row?.id === proofPlaylist.id)) return rows;
  return [proofPlaylist, ...rows];
}

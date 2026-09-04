export type BundleUse = "sync" | "game" | "label" | "transmedia";

export interface AttributionSplit {
  owner: string;
  share: number;
}

export interface Playlist {
  id: string;
  name: string;
  owner: string;
  domain: string;
  clusterIds: string[];
  productType: BundleUse;
  license: "personal" | "sync" | "commercial";
  attribution: AttributionSplit[];
  b2bReady: boolean;
  createdAt: string;
}

const g = globalThis as any;

if (!g.__shiyanPlaylists) {
  g.__shiyanPlaylists = [
    {
      id: "pl_label_001",
      name: "Shiyan Yishu Label Playlist",
      owner: "ECMcCready",
      domain: "music",
      clusterIds: [],
      productType: "label",
      license: "commercial",
      attribution: [{ owner: "ECMcCready", share: 1 }],
      b2bReady: true,
      createdAt: new Date().toISOString(),
    },
  ] as Playlist[];
}

function store(): Playlist[] {
  return g.__shiyanPlaylists as Playlist[];
}

function rebuildAttribution(playlist: Playlist) {
  const owners = ["ECMcCready"];
  const share = Number((1 / owners.length).toFixed(3));
  playlist.attribution = owners.map((owner) => ({ owner, share }));
  playlist.b2bReady = playlist.clusterIds.length > 0 || playlist.license !== "personal";
}

export function addClusterToPlaylist(clusterId: string): Playlist {
  const playlist = store()[0];
  if (!playlist.clusterIds.includes(clusterId)) {
    playlist.clusterIds.push(clusterId);
  }
  rebuildAttribution(playlist);
  return playlist;
}

export function getPlaylists(): Playlist[] {
  return store();
}

export function licensePlaylist(id: string, use: BundleUse = "sync") {
  const playlist = store().find((item) => item.id === id) || store()[0];
  playlist.productType = use;
  playlist.license = use === "label" ? "commercial" : "sync";
  playlist.b2bReady = true;
  rebuildAttribution(playlist);
  return {
    success: true,
    playlist,
    message: `B2B license prepared for ${use}. Attribution splits stay on the engine.`,
  };
}
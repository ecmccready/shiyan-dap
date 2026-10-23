import { persistGet, persistPut } from "@/lib/persist";
import fs from "node:fs";
import path from "node:path";

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

const file = path.join(process.cwd(), "src/data/playlist.json");
const g = globalThis as typeof globalThis & {
  __shiyanPlaylists?: Playlist[];
  __shiyanPlaylistsLoad?: Promise<Playlist[]>;
};

const fallback: Playlist[] = [
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
];

function readDisk(): Playlist[] | null {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeDisk(playlists: Playlist[]) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(playlists, null, 2));
  } catch {
    // Vercel is read-only; memory still holds for the warm instance.
  }
}

async function loadPlaylists(): Promise<Playlist[]> {
  if (g.__shiyanPlaylists) return g.__shiyanPlaylists;
  if (!g.__shiyanPlaylistsLoad) {
    g.__shiyanPlaylistsLoad = persistGet<Playlist[]>("playlist.json")
      .then((persisted) => {
        const playlists = persisted ?? readDisk() ?? fallback;
        g.__shiyanPlaylists = playlists;
        return playlists;
      })
      .finally(() => {
        g.__shiyanPlaylistsLoad = undefined;
      });
  }
  return g.__shiyanPlaylistsLoad;
}

async function save(playlists: Playlist[]) {
  g.__shiyanPlaylists = playlists;
  writeDisk(playlists);
  await persistPut("playlist.json", playlists);
}

function rebuildAttribution(playlist: Playlist) {
  playlist.attribution = [{ owner: playlist.owner || "ECMcCready", share: 1 }];
  playlist.b2bReady =
    playlist.clusterIds.length > 0 || playlist.license !== "personal";
}

export async function addClusterToPlaylist(clusterId: string): Promise<Playlist> {
  const playlists = await loadPlaylists();
  const playlist = playlists[0];
  if (!playlist.clusterIds.includes(clusterId)) {
    playlist.clusterIds.push(clusterId);
  }
  rebuildAttribution(playlist);
  await save(playlists);
  return playlist;
}

export async function getPlaylists(): Promise<Playlist[]> {
  return loadPlaylists();
}

export async function licensePlaylist(id: string, use: BundleUse = "sync") {
  const playlists = await loadPlaylists();
  const playlist = playlists.find((item) => item.id === id);
  if (!playlist) return null;
  playlist.productType = use;
  playlist.license = use === "label" ? "commercial" : "sync";
  playlist.b2bReady = true;
  rebuildAttribution(playlist);
  await save(playlists);
  return {
    success: true,
    playlist,
    message: `B2B license prepared for ${use}. Attribution splits stay on the engine.`,
  };
}
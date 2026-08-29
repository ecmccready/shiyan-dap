export interface Playlist {
  id: string;
  name: string;
  domain: "music";
  owner: string;
  clusterIds: string[];
  createdAt: string;
}

const playlists: Playlist[] = [
  {
    id: "pl_main",
    name: "Shiyan Yishu Label Playlist",
    domain: "music",
    owner: "ECMcCready",
    clusterIds: [],
    createdAt: new Date().toISOString(),
  },
];

export function addClusterToPlaylist(clusterId: string, playlistId = "pl_main") {
  const playlist = playlists.find((p) => p.id === playlistId) || playlists[0];
  if (!playlist.clusterIds.includes(clusterId)) {
    playlist.clusterIds.push(clusterId);
  }
  return playlist;
}

export function getPlaylists() {
  return playlists;
}
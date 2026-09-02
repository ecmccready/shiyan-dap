export type DomainId =
  | "music"
  | "music-video"
  | "visual"
  | "text"
  | "esports"
  | "social-transmedia"
  | "gameplay"
  | "animation"
  | "real-estate";

export interface DomainConfig {
  id: DomainId;
  label: string;
  description: string;
  defaultArtist: string;
  themes: string[];
  evidence: string[];
  approach: string;
}

export const domains: Record<DomainId, DomainConfig> = {
  music: {
    id: "music",
    label: "Music",
    description: "Songs, playlists, and music videos as owned narrative assets",
    defaultArtist: "ECMcCready",
    themes: ["playlist", "music video", "independent", "generative"],
    evidence: ["audio", "lyrics", "performance", "playlist context"],
    approach: "Cluster songs into living playlists that can be monetized and tokenized",
  },
  "music-video": {
    id: "music-video",
    label: "Music Video",
    description:
      "Song + picture as a sellable audiovisual cluster under the Music label theater",
    defaultArtist: "ECMcCready",
    themes: ["music video", "playlist", "visual narrative", "single"],
    evidence: ["song", "picture", "sequence", "performance"],
    approach:
      "Package the song and its visual story as one owned, tokenizable launch asset",
  },
  visual: {
    id: "visual",
    label: "Visual / Generative Art",
    description: "Images, generative art, and aesthetic systems",
    defaultArtist: "ECMcCready",
    themes: ["generative", "aesthetic", "narrative image", "style transfer"],
    evidence: ["image", "style", "composition"],
    approach: "Prompt-based generative visual systems with ownership",
  },
  text: {
    id: "text",
    label: "Text / Narrative",
    description: "Legacy text domain (absorbed into Social Transmedia)",
    defaultArtist: "ECMcCready",
    themes: ["story", "world-building", "character", "theme"],
    evidence: ["prose", "dialogue", "structure"],
    approach: "Structured narrative extraction",
  },
  esports: {
    id: "esports",
    label: "eSports",
    description: "Competitive play, teams, audiences, and performance networks",
    defaultArtist: "ECMcCready",
    themes: ["competition", "audience", "performance", "league"],
    evidence: ["match record", "team structure", "audience signal", "outcome"],
    approach: "Cluster competitive performance into owned, transferable value",
  },
  "social-transmedia": {
    id: "social-transmedia",
    label: "Social Transmedia",
    description:
      "Multi-platform narrative ecosystems that span story, music, visual, and interactive experiences — beyond social media",
    defaultArtist: "ECMcCready",
    themes: [
      "transmedia",
      "storyworld",
      "cross-platform",
      "audience participation",
      "narrative continuity",
    ],
    evidence: ["story arcs", "character presence", "platform bridges", "audience signals"],
    approach:
      "Treat every narrative fragment as a node in a living storyworld that can be clustered, owned, and monetized",
  },
  gameplay: {
    id: "gameplay",
    label: "Gameplay",
    description: "Playable systems, rules, sessions, and in-world economies",
    defaultArtist: "ECMcCready",
    themes: ["play", "rules", "session", "in-world economy"],
    evidence: ["game state", "player actions", "session log", "economy signals"],
    approach: "Cluster playable systems into owned narrative-economic objects",
  },
  animation: {
    id: "animation",
    label: "Animation",
    description:
      "Animated storyworlds, feature pipelines, and character systems (source: Shiyan Meishu – The Heavenly Palace)",
    defaultArtist: "ECMcCready",
    themes: [
      "storyworld",
      "character systems",
      "feature pipeline",
      "transmedia animation",
      "Chinese mythos",
    ],
    evidence: ["screenplay", "character design", "sequence", "world rules"],
    approach:
      "Turn screenplay and animation development into living, ownable, tokenizable narrative clusters",
  },
  "real-estate": {
    id: "real-estate",
    label: "Real Estate",
    description: "Property narratives, ownership clusters, and spatial value systems",
    defaultArtist: "ECMcCready",
    themes: ["property", "ownership", "spatial", "development", "place-based narrative"],
    evidence: ["location", "ownership record", "development story", "value signals"],
    approach: "Cluster place-based and ownership narratives into tradable real-estate intelligence",
  },
};

export type Domain = DomainId;
export type DomainId =
  | "music"
  | "visual"
  | "text"
  | "professional"
  | "social-transmedia"
  | "blockchain-games"
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
  professional: {
    id: "professional",
    label: "Professional / Competency",
    description: "Skills, process, and outcome networks",
    defaultArtist: "ECMcCready",
    themes: ["competency", "process", "outcome", "compliance"],
    evidence: ["credentials", "process logs", "results"],
    approach: "Competency networks as tradable clusters",
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
  "blockchain-games": {
    id: "blockchain-games",
    label: "Blockchain Games",
    description: "Playable economies, on-chain assets, and game narratives",
    defaultArtist: "ECMcCready",
    themes: ["play-to-own", "on-chain economy", "game narrative", "asset utility"],
    evidence: ["game state", "asset ownership", "player actions", "economy signals"],
    approach: "Clusters of game assets and narratives that carry real economic weight",
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
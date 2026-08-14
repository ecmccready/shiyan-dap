export type Domain = "music" | "visual" | "text" | "professional";

export interface DomainConfig {
  id: Domain;
  label: string;
  defaultArtist: string;
  themes: string[];
  evidence: string[];
  musicalOrCreativeApproach: string;
}

export const domains: Record<Domain, DomainConfig> = {
  music: {
    id: "music",
    label: "Music",
    defaultArtist: "ECMcCready",
    themes: [
      "hyper-reality",
      "simulation",
      "generative art",
      "multiverse",
      "ads",
    ],
    evidence: ["lyrics", "guitar-pro", "bass", "drums"],
    musicalOrCreativeApproach: "Dropped D • 180 BPM • punk-metal",
  },
  visual: {
    id: "visual",
    label: "Visual / Generative Art",
    defaultArtist: "ECMcCready",
    themes: ["generative", "aesthetic", "narrative image", "style transfer"],
    evidence: ["prompt", "image", "seed", "parameters"],
    musicalOrCreativeApproach: "Prompt-based generative visual system",
  },
  text: {
    id: "text",
    label: "Text / Narrative",
    defaultArtist: "ECMcCready",
    themes: ["story", "world-building", "character", "theme"],
    evidence: ["manuscript", "outline", "chapters"],
    musicalOrCreativeApproach: "Long-form narrative structure",
  },
  professional: {
    id: "professional",
    label: "Professional Domain",
    defaultArtist: "ECMcCready",
    themes: ["competency", "process", "outcome", "compliance"],
    evidence: ["case", "protocol", "result", "attestation"],
    musicalOrCreativeApproach: "Domain-specific competency model",
  },
};
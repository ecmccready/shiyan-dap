import { addClusterToMarketplace } from "@/lib/marketplace";
import { NextResponse } from "next/server";
import seed from "@/data/seed/shiyan-yishu.json";
import { domains, Domain } from "@/lib/domains";
import { runModelAdapter } from "@/lib/model-adapter";
import { recordOutcome, getAveragePiInv, getRecentOutcomes } from "@/lib/outcomes";

async function runAgent(domainId: Domain = "music") {
  const domain = domains[domainId];

  // 1. Model Adapter
  const rawNarrative = seed.lyrics?.verse1 || "No narrative provided";
  const modelResult = await runModelAdapter(rawNarrative, {
  provider: "grok",
});

  // Domain-specific content
  const domainSpecific = {
    music: {
      clusterName: "Punk Metal × Hyper-Reality",
      policyName: "Indie Punk Fashion Drop",
      policyAction: "Target fans who love hyper-reality + generative aesthetics",
      approach: "Dropped D • 180 BPM • punk-metal",
      evidence: ["lyrics", "guitar-pro", "bass", "drums"],
    },
    visual: {
      clusterName: "Generative Visual × Aesthetic Networks",
      policyName: "Digital Art Marketplace Boost",
      policyAction: "Target collectors who engage with generative and narrative imagery",
      approach: "Prompt-based generative visual system",
      evidence: ["prompt", "image", "seed", "parameters"],
    },
    text: {
      clusterName: "Narrative Worlds × Story Clusters",
      policyName: "Long-form Fiction Promotion",
      policyAction: "Target readers who follow world-building and character-driven stories",
      approach: "Long-form narrative structure",
      evidence: ["manuscript", "outline", "chapters"],
    },
    professional: {
      clusterName: "Competency Networks × Professional Memory",
      policyName: "Enterprise Knowledge Extension",
      policyAction: "Target institutions seeking structured competency and outcome data",
      approach: "Domain-specific competency model",
      evidence: ["case", "protocol", "result", "attestation"],
    },
  }[domainId];

  // Base similarity
  let similarity = 0.87;

  // Self-improvement: slightly adjust based on previous outcomes
  const avgPi = getAveragePiInv(domain.label);
  if (avgPi !== null) {
    // If previous runs were strong, nudge similarity upward slightly
    similarity = Math.min(0.95, similarity + (avgPi - 0.8) * 0.1);
  }

  const ell = 1 - similarity;
  const pi_inv = 1 - ell;

  // ── Miller Pyramid ──
  const pyramid = {
    Know: {
      level: "Know",
      description: "Basic facts about the content",
      content: {
        title: seed.title,
        artist: seed.artist || domain.defaultArtist,
        domain: domain.label,
        model_provider: modelResult.provider,
        model_confidence: modelResult.confidence,
      },
    },
    "Knows-How": {
      level: "Knows-How",
      description: "How the content is structured",
      content: {
        narrative_structure:
          domainId === "music" ? "Verse-Chorus form" : "Structured narrative",
        themes: domain.themes,
        approach: domainSpecific.approach,
        cleaned_preview: modelResult.cleanedText.slice(0, 100) + "...",
      },
    },
    "Shows-How": {
      level: "Shows-How",
      description: "What can be demonstrated",
      content: {
        evidence: domainSpecific.evidence,
        demonstrable: "Structured memory + AI clusters + policy extension",
      },
    },
    Does: {
      level: "Does",
      description: "Real-world action and outcomes",
      content: {
        status: "Self-improving loop active",
        ownership: "Fully owned by ECMcCready",
        next_action: "Continue multi-domain scaling",
        recent_outcomes: getRecentOutcomes(domain.label, 3).length,
      },
    },
  };

  // ── Cluster ──
  const cluster = {
    id: `cluster-${domainId}-001`,
    name: domainSpecific.clusterName,
    size: 1,
    members: [seed.title],
    tags: domain.themes.slice(0, 4),
  };

  // ── Policy Extension ──
  const policyExtension = {
    policy_name: domainSpecific.policyName,
    source: "B2B Advertiser",
    similarity_score: Number(similarity.toFixed(3)),
    status: "Successfully extended into cluster",
    action: domainSpecific.policyAction,
  };

  // ── Settlement ──
  const settlement = {
    status: "Ready for smart-contract",
    artist_share: "70%",
    platform_share: "30%",
    mock_revenue: "$42.00",
    artist_payout: "$29.40",
    method: "Tokenized split via future smart contract",
  };

  // Record this run as an outcome (self-improvement data)
  recordOutcome({
    domain: domain.label,
    pi_inv: Number(pi_inv.toFixed(3)),
    ell: Number(ell.toFixed(3)),
    similarity: Number(similarity.toFixed(3)),
    timestamp: new Date().toISOString(),
  });
  // ── Register cluster into the Missing Middle Marketplace ──
  addClusterToMarketplace({
    id: cluster.id,
    name: cluster.name,
    domain: domain.label,
    size: cluster.size,
    tags: cluster.tags,
    similarity: policyExtension.similarity_score,
    pi_inv: Number(pi_inv.toFixed(3)),
    status: "available",
    owner: seed.artist || domain.defaultArtist,
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  });
  return {
    success: true,
    message: "Full GTP loop complete (with self-improvement)",
    domain: domain.label,
    title: seed.title,
    artist: seed.artist,
    lyrics: seed.lyrics,
    model: {
      provider: modelResult.provider,
      confidence: modelResult.confidence,
    },
    self_improvement: {
      average_pi_inv: avgPi,
      outcomes_recorded: getRecentOutcomes(domain.label).length,
    },
    pyramid,
    cluster,
    policyExtension,
    settlement,
    pi_inv: Number(pi_inv.toFixed(3)),
    ell: Number(ell.toFixed(3)),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domainParam = searchParams.get("domain") as Domain | null;
  const domain: Domain =
    domainParam && domains[domainParam] ? domainParam : "music";

  const result = await runAgent(domain);
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const domainParam = searchParams.get("domain") as Domain | null;
  const domain: Domain =
    domainParam && domains[domainParam] ? domainParam : "music";

  const result = await runAgent(domain);
  return NextResponse.json(result);
}
import { NextResponse } from "next/server";
import { domains, Domain } from "@/lib/domains";
import { addClusterToMarketplace } from "@/lib/marketplace";
import { recordOutcome, getSelfImprovementMetrics } from "@/lib/outcomes";
import { runModelAdapter } from "@/lib/model-adapter";
import { createToken } from "@/lib/token";
import { computeAdSignal } from "@/lib/ads";

async function runAgent(domainId: Domain = "music", userText: string = "") {
  const domain = domains[domainId] || domains.music;

  const seed = {
    title: userText
      ? `${domain.label} User Narrative`
      : `${domain.label} Seed Narrative`,
    artist: domain.defaultArtist,
    description: userText || domain.description,
    themes: domain.themes,
    rawInput: userText || null,
  };

  const modelResult = await runModelAdapter(
    userText
      ? `Structure this ${domain.label} narrative for clustering, policy extension, and ad-based monetization: ${userText}`
      : `Analyze and structure this ${domain.label} narrative for clustering and policy extension: ${seed.description}. Themes: ${domain.themes.join(", ")}`,
    { provider: "grok" }
  );

  const modelInfo = {
    provider: modelResult.provider || "mock",
    confidence: modelResult.confidence || 0.82,
    raw: modelResult,
  };

  const ell = 0.15 + Math.random() * 0.1;
  const pi_inv = Number((1 - ell).toFixed(3));

  const pyramid = {
    know: {
      level: "Know",
      description: "Factual knowledge of the content",
      content: {
        title: seed.title,
        artist: seed.artist,
        domain: domain.label,
        themes: domain.themes,
        rawInput: seed.rawInput,
      },
    },
    knowsHow: {
      level: "Knows-How",
      description: "Procedural understanding",
      content: {
        approach: domain.approach,
        evidence: domain.evidence,
      },
    },
    showsHow: {
      level: "Shows-How",
      description: "Demonstrated structure",
      content: {
        structure: "Cluster-ready narrative object",
        model: modelInfo.provider,
      },
    },
    does: {
      level: "Does",
      description: "Actionable outcome",
      content: {
        action: "Ready for marketplace, tokens, and ad-based extension",
        pi_inv,
      },
    },
  };

  const cluster = {
    id: `cl_${domainId}_${Date.now()}`,
    name: `${domain.label} × ${domain.themes[0] || "Core"}`,
    domain: domain.label,
    size: 1,
    tags: domain.themes.slice(0, 4),
    similarity: Number((0.85 + Math.random() * 0.1).toFixed(3)),
  };

  const adSignal = computeAdSignal({
    pi_inv,
    similarity: cluster.similarity,
    hasUserInput: Boolean(userText),
    domain: domain.label,
  });

  const policyExtension = {
    policy_name: `${domain.label} Value Extension`,
    action: "Extend into marketplace inventory, tokens, and ad-based pipelines",
    similarity_score: cluster.similarity,
  };

  addClusterToMarketplace({
    id: cluster.id,
    name: cluster.name,
    domain: domain.label,
    size: cluster.size,
    tags: cluster.tags,
    similarity: cluster.similarity,
    pi_inv,
    status: "available",
    owner: seed.artist,
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    adSignal,
  } as any);

  let token = null;
  if (domainId === "music") {
    token = createToken({
      symbol: "MUSIC",
      name: cluster.name,
      domain: "music",
      owner: seed.artist,
      initialSupply: 1000,
      price: Number((1 + cluster.similarity).toFixed(2)),
    });
  }

  recordOutcome({
    domain: domain.label,
    pi_inv,
    ell: Number(ell.toFixed(3)),
    clusterId: cluster.id,
    modelProvider: modelInfo.provider,
  });

  return {
    success: true,
    message: "Full GTP loop complete (with self-improvement)",
    domain: domain.label,
    title: seed.title,
    artist: seed.artist,
    pyramid,
    cluster,
    adSignal,
    policyExtension,
    model: modelInfo,
    token,
    pi_inv,
    ell: Number(ell.toFixed(3)),
    self_improvement: getSelfImprovementMetrics(domain.label),
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
    domainParam && domains[domainParam] ? domainParam : "social-transmedia";

  let userText = "";
  try {
    const body = await request.json();
    userText = body?.input || body?.text || "";
  } catch {
    userText = "";
  }

  const result = await runAgent(domain, userText);
  return NextResponse.json(result);
}
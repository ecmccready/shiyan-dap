import { NextResponse } from "next/server";
import { domains, Domain } from "@/lib/domains";
import { addClusterToMarketplace } from "@/lib/marketplace";
import { recordOutcome, getSelfImprovementMetrics } from "@/lib/outcomes";
import { runModelAdapter } from "@/lib/model-adapter";

async function runAgent(domainId: Domain = "music") {
  const domain = domains[domainId] || domains.music;

  // 1. Seed (Know)
  const seed = {
    title: `${domain.label} Seed Narrative`,
    artist: domain.defaultArtist,
    description: domain.description,
    themes: domain.themes,
  };

  // 2. Call the model adapter
  const modelResult = await runModelAdapter(
    `Analyze and structure this ${domain.label} narrative for clustering and policy extension: ${seed.description}. Themes: ${domain.themes.join(", ")}`,
    { provider: "grok" } // change to "mock" if you want to avoid API calls
  );

  const modelInfo = {
    provider: modelResult.provider || "mock",
    confidence: modelResult.confidence || 0.82,
    raw: modelResult,
  };

  // 3. Simple loss + inverting policy
  const ell = 0.15 + Math.random() * 0.1;
  const pi_inv = Number((1 - ell).toFixed(3));

  // 4. Miller Pyramid
  const pyramid = {
    know: {
      level: "Know",
      description: "Factual knowledge of the content",
      content: {
        title: seed.title,
        artist: seed.artist,
        domain: domain.label,
        themes: domain.themes,
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
        action: "Ready for marketplace and policy extension",
        pi_inv,
      },
    },
  };

  // 5. Cluster
  const cluster = {
    id: `cl_${domainId}_${Date.now()}`,
    name: `${domain.label} × ${domain.themes[0] || "Core"}`,
    domain: domain.label,
    size: 1,
    tags: domain.themes.slice(0, 4),
    similarity: Number((0.85 + Math.random() * 0.1).toFixed(3)),
  };

  // 6. Policy Extension
  const policyExtension = {
    policy_name: `${domain.label} Value Extension`,
    action: "Extend into marketplace inventory and token potential",
    similarity_score: cluster.similarity,
  };

  // 7. Register into Marketplace
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
  });

  // 8. Record outcome for .self()
  recordOutcome({
    domain: domain.label,
    pi_inv,
    ell: Number(ell.toFixed(3)),
    clusterId: cluster.id,
    modelProvider: modelInfo.provider,
  });

  // 9. Return full result
  return {
    success: true,
    message: "Full GTP loop complete (with self-improvement)",
    domain: domain.label,
    title: seed.title,
    artist: seed.artist,
    pyramid,
    cluster,
    policyExtension,
    model: modelInfo,
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
    domainParam && domains[domainParam] ? domainParam : "music";

  const result = await runAgent(domain);
  return NextResponse.json(result);
}
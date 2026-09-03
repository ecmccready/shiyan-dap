import { NextResponse } from "next/server";
import { domains, Domain } from "@/lib/domains";
import { addClusterToMarketplace } from "@/lib/marketplace";
import { recordOutcome, getSelfImprovementMetrics } from "@/lib/outcomes";
import { createToken } from "@/lib/token";
import { computeAdSignal } from "@/lib/ads";
import { routeModels, RoutePath } from "@/lib/router";
import { createSovereigntyRecord } from "@/lib/sovereignty";
import { calibratePolicy } from "@/lib/policy";
import { addClusterToPlaylist } from "@/lib/playlist";
import { computeEmergence } from "@/lib/emergence";
import { splitAdValue, containHomePage } from "@/lib/economy";

async function runAgent(
  domainId: Domain = "music",
  userText: string = "",
  path: RoutePath = "fast"
) {
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

  const routed = await routeModels(
    userText
      ? `Structure this ${domain.label} narrative for clustering, policy extension, and ad-based monetization: ${userText}`
      : `Analyze and structure this ${domain.label} narrative for clustering and policy extension: ${seed.description}. Themes: ${domain.themes.join(", ")}`,
    path
  );

  const modelInfo = {
    provider: routed.primary.provider || "mock",
    confidence: routed.mergedConfidence,
    path: routed.path,
    disagreement: routed.disagreement,
    secondaryProvider: routed.secondary?.provider || null,
    raw: routed.primary,
  };

  const ell = Number(
    (0.15 + routed.disagreement * 0.2 + Math.random() * 0.05).toFixed(3)
  );
  const pi_inv = Number((1 - ell).toFixed(3));

  const zPolicy = calibratePolicy({
    x: pi_inv,
    z: domainId === "music" || domainId === "music-video" ? 1.2 : 1,
    C: 0.05,
  });

  const sovereignty = createSovereigntyRecord({
    dataOwner: seed.artist,
    protocolOwner: "ECMcCready",
    trainingGranted: true,
  });

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
        path: modelInfo.path,
      },
    },
    does: {
      level: "Does",
      description: "Actionable outcome",
      content: {
        action:
          "Ready for marketplace, tokens, playlist settlement, and ad-based extension",
        pi_inv,
        y: zPolicy.y,
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

  const emergence = computeEmergence({
    attention: adSignal.attentionScore,
    z: domainId === "music" || domainId === "music-video" ? 1.2 : 1,
    C: 0.05,
  });

  const adPayout = splitAdValue(adSignal.attentionScore);
  const containedHome = containHomePage({
    clusterId: cluster.id,
    owner: seed.artist,
  });

  const policyExtension = {
    policy_name: `${domain.label} Value Extension`,
    action:
      "Acquire on Social Transmedia, retain in Marketplace, transfer on Playlist",
    similarity_score: cluster.similarity,
    y: zPolicy.y,
    z: zPolicy.z,
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
    adPayout,
    containedHome,
    sovereignty,
    zPolicy,
    emergence,
  } as any);

  let token = null;
  let playlist = null;
  if (domainId === "music" || domainId === "music-video") {
    token = createToken({
      symbol: domainId === "music-video" ? "MVID" : "MUSIC",
      name: cluster.name,
      domain: domainId,
      owner: seed.artist,
      initialSupply: 1000,
      price: Number((1 + cluster.similarity).toFixed(2)),
    });
    playlist = addClusterToPlaylist(cluster.id);
  }

  recordOutcome({
    domain: domain.label,
    pi_inv,
    ell,
    clusterId: cluster.id,
    modelProvider: modelInfo.provider,
  });

  return {
    success: true,
    message: "Emergent Slice v1 loop complete",
    domain: domain.label,
    title: seed.title,
    artist: seed.artist,
    pyramid,
    cluster,
    adSignal,
    adPayout,
    containedHome,
    emergence,
    policyExtension,
    model: modelInfo,
    token,
    playlist,
    sovereignty,
    zPolicy,
    pi_inv,
    ell,
    self_improvement: getSelfImprovementMetrics(domain.label),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domainParam = searchParams.get("domain") as Domain | null;
  const pathParam = searchParams.get("path") as RoutePath | null;
  const domain: Domain =
    domainParam && domains[domainParam] ? domainParam : "music";
  const path: RoutePath = pathParam === "deep" ? "deep" : "fast";

  const result = await runAgent(domain, "", path);
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const domainParam = searchParams.get("domain") as Domain | null;
  const domain: Domain =
    domainParam && domains[domainParam] ? domainParam : "social-transmedia";

  let userText = "";
  let path: RoutePath = "fast";
  try {
    const body = await request.json();
    userText = body?.input || body?.text || "";
    if (body?.path === "deep") path = "deep";
  } catch {
    userText = "";
  }

  const result = await runAgent(domain, userText, path);
  return NextResponse.json(result);
}
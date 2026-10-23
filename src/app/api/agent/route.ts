import { NextResponse } from "next/server";
import { domains, Domain } from "@/lib/domains";
import { addClusterToMarketplace } from "@/lib/marketplace";
import { getSelfImprovementMetrics } from "@/lib/outcomes";
import { createToken } from "@/lib/token";
import { computeAdSignal } from "@/lib/ads";
import { routeModels, RoutePath } from "@/lib/router";
import { createSovereigntyRecord } from "@/lib/sovereignty";
import { calibratePolicy } from "@/lib/policy";
import { addClusterToPlaylist } from "@/lib/playlist";
import { computeEmergence } from "@/lib/emergence";
import { splitAdValue, containHomePage } from "@/lib/economy";
import { allocateCapital } from "@/lib/capital";
import { emitTrainingRecord } from "@/lib/huggingface";

function isDomain(value: string | null): value is Domain {
  return value !== null && Object.prototype.hasOwnProperty.call(domains, value);
}

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

  const capital = allocateCapital({
    attention: adSignal.attentionScore,
  });

  const policyExtension = {
    policy_name: `${domain.label} Value Extension`,
    action:
      "Acquire on Social Transmedia, retain in Marketplace, transfer on Playlist",
    similarity_score: cluster.similarity,
    y: zPolicy.y,
    z: zPolicy.z,
  };

  await addClusterToMarketplace({
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
    capital,
  });

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
    playlist = await addClusterToPlaylist(cluster.id);
  }

  const hf = await emitTrainingRecord({
    clusterId: cluster.id,
    domain: domain.label,
    input: seed.rawInput || seed.description,
    cleaned: modelInfo.raw?.cleanedText,
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
    capital,
    hf,
    policyExtension,
    model: modelInfo,
    token,
    playlist,
    sovereignty,
    zPolicy,
    pi_inv,
    ell,
    self_improvement: getSelfImprovementMetrics(),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domainParam = searchParams.get("domain");
  const pathParam = searchParams.get("path");
  const domain: Domain = isDomain(domainParam) ? domainParam : "music";
  const path: RoutePath = pathParam === "deep" ? "deep" : "fast";

  const result = await runAgent(domain, "", path);
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const domainParam = searchParams.get("domain");
  const domain: Domain = isDomain(domainParam)
    ? domainParam
    : "social-transmedia";

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { success: false, error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }

  const input = "input" in body ? body.input : undefined;
  const text = "text" in body ? body.text : undefined;
  if (
    (input !== undefined && typeof input !== "string") ||
    (text !== undefined && typeof text !== "string")
  ) {
    return NextResponse.json(
      { success: false, error: "input and text must be strings" },
      { status: 400 }
    );
  }

  const userText =
    typeof input === "string" && input ? input : typeof text === "string" ? text : "";
  const path: RoutePath = "path" in body && body.path === "deep" ? "deep" : "fast";
  const result = await runAgent(domain, userText, path);
  return NextResponse.json(result);
}
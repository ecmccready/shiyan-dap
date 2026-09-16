import { computeB, Self } from "@/lib/outcomes";

export interface BotContext {
  message: string;
  clusterId?: string;
  domain?: string;
  userId?: string;
}

export interface BotResponse {
  reply: string;
  mode: "simulated" | "live";
  suggestedActions?: string[];
  clusterId?: string;
  confidence: number;
  z?: string;
  b?: string;
}

function controllerLine() {
  const self = Self();
  const b = computeB();
  return `${self.z} · B ${b.action} · e ${self.eA}`;
}

function speak(text: string) {
  return `${controllerLine()}. ${text}`;
}

export async function runGrokBot(
  context: BotContext,
  mode: "simulated" | "live" = "simulated"
): Promise<BotResponse> {
  const lower = String(context.message || "").toLowerCase();
  const self = Self();
  const b = computeB();
  const z = self.z;

  if (
    lower.includes("pay") ||
    lower.includes("engine") ||
    lower.includes("advert") ||
    lower.includes("ad pay")
  ) {
    return {
      reply: speak(
        "Ads pay both sides: 70% to the user, 30% to the engine. Fiat is the root. Crypto is later."
      ),
      mode,
      suggestedActions: ["Pay User", "Pay Engine", "Open Marketplace", "Buy"],
      clusterId: context.clusterId,
      confidence: 0.94,
      z,
      b: b.action,
    };
  }

  if (
    lower.includes("b2b") ||
    lower.includes("b2c") ||
    lower.includes("c2c") ||
    lower.includes("contain")
  ) {
    return {
      reply: speak(
        "C2C writes the Home. Marketplace contains that Home as B2C inventory. Settle promotes it to B2B. I speak Self().z. I do not name B."
      ),
      mode,
      suggestedActions: ["Contain Home", "Promote B2B", "Transfer", "Protocol"],
      clusterId: context.clusterId,
      confidence: 0.93,
      z,
      b: b.action,
    };
  }

  if (lower.includes("upload") || lower.includes("audio") || lower.includes("master")) {
    return {
      reply: speak(
        "Upload is the file door. Attach the master when Cubase or Guitar Pro is ready. The First Single can sell before the file exists."
      ),
      mode,
      suggestedActions: ["Open Upload", "Open Single", "Protocol", "Learn"],
      clusterId: context.clusterId,
      confidence: 0.92,
      z,
      b: b.action,
    };
  }

  if (
    lower.includes("acquire") ||
    lower.includes("transmedia") ||
    lower.includes("retain") ||
    lower.includes("marketplace") ||
    lower.includes("transfer") ||
    lower.includes("playlist") ||
    lower.includes("settle")
  ) {
    return {
      reply: speak(
        "x acquires. y is settlement. z is Self(). The market is a later reality check."
      ),
      mode,
      suggestedActions: ["Acquire", "Learn", "Protocol", "Hold"],
      clusterId: context.clusterId,
      confidence: 0.93,
      z,
      b: b.action,
    };
  }

  if (
    lower.includes("refine") ||
    lower.includes("analyze") ||
    lower.includes("deep") ||
    lower.includes("hy4") ||
    lower.includes("attention")
  ) {
    return {
      reply: speak(
        "Deep path is a seat. Grok and Hy4 compare language. They do not replace computeB()."
      ),
      mode,
      suggestedActions: ["Evaluate outcome", "View Protocol", "Learn"],
      clusterId: context.clusterId,
      confidence: 0.91,
      z,
      b: b.action,
    };
  }

  if (lower.includes("protocol") || lower.includes("tool") || lower.includes("langchain")) {
    return {
      reply: speak(
        "Protocol first. LangChain second. Tools call computeB. LangChain is not the marketplace."
      ),
      mode,
      suggestedActions: ["Open Protocol", "Evaluate outcome", "Hold"],
      clusterId: context.clusterId,
      confidence: 0.95,
      z,
      b: b.action,
    };
  }

  if (lower.includes("hold") || lower.includes("self") || lower.includes("z")) {
    return {
      reply: speak("Hold is the current resolution. No new founder click."),
      mode,
      suggestedActions: ["Open Learn", "Open Protocol", "Hold"],
      clusterId: context.clusterId,
      confidence: 0.96,
      z,
      b: b.action,
    };
  }

  if (lower.includes("buy")) {
    return {
      reply: speak(
        "Buy is ready on the fiat root. An independent $1 validates HOLD. It does not birth B."
      ),
      mode,
      suggestedActions: ["Confirm Buy", "Learn", "Protocol"],
      clusterId: context.clusterId,
      confidence: 0.9,
      z,
      b: b.action,
    };
  }

  if (lower.includes("sell")) {
    return {
      reply: speak("Sell stays on Marketplace retention. You keep the source data."),
      mode,
      suggestedActions: ["Confirm Sell", "Protocol", "Learn"],
      clusterId: context.clusterId,
      confidence: 0.9,
      z,
      b: b.action,
    };
  }

  if (lower.includes("trade")) {
    return {
      reply: speak("Trade moves value across domains. Only Music has live settlement."),
      mode,
      suggestedActions: ["Confirm Trade", "Open Playlist", "Protocol"],
      clusterId: context.clusterId,
      confidence: 0.9,
      z,
      b: b.action,
    };
  }

  if (lower.includes("explore") || lower.includes("cluster")) {
    return {
      reply: speak("I can inspect official singles through the protocol. Music remains the cash-flow domain."),
      mode,
      suggestedActions: ["Search assets", "Inspect asset", "Protocol"],
      clusterId: context.clusterId,
      confidence: 0.88,
      z,
      b: b.action,
    };
  }

  return {
    reply: speak("I am the Act seat. I speak Self().z. I do not name B."),
    mode,
    suggestedActions: ["Open Learn", "Evaluate outcome", "Hold", "Protocol"],
    clusterId: context.clusterId,
    confidence: 0.88,
    z,
    b: b.action,
  };
}
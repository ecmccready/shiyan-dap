export type BClass = "controlled" | "live";

export const AGENT_A = "Agent A · ECMcCready";
export const CONTROLLED_B = "Controlled B · session";
export const LIVE_B = "Agent B · independent";

export function isLiveMarketB(agent: string, simulated: boolean) {
  return !simulated && agent.includes("Agent B") && agent.includes("independent");
}

export function isControlledB(agent: string) {
  return agent.includes("Controlled B") || agent.includes("potential customer");
}

export function classifyB(agent: string, simulated: boolean): BClass | "none" {
  if (isLiveMarketB(agent, simulated)) return "live";
  if (isControlledB(agent) || (agent.includes("Agent B") && !simulated)) return "controlled";
  return "none";
}
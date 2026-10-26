import type { AssetDomain, LedgerEventPayload } from "./ledger";

/** A tool a workbench plugin exposes to agents. */
export interface AgentTool {
  name: string;
  description: string;
  /** JSON Schema describing the input. */
  inputSchema: Record<string, unknown>;
  execute: (input: unknown, ctx: ExecutionContext) => Promise<unknown>;
}

/** Emitted by plugins to record state changes in the invisible micro-ledger. */
export interface LedgerHookEvent {
  pluginId: string;
  domain: AssetDomain;
  event: LedgerEventPayload;
}

/** Passed to every tool execution. */
export interface ExecutionContext {
  runId?: string;
  actorId?: string;
  /** Records a ledger event; failures must not break the calling tool. */
  emitLedgerEvent: (event: LedgerHookEvent) => Promise<void>;
}

export interface WorkbenchPlugin {
  id: string;
  name: string;
  domain: AssetDomain;
  version: string;
  tools: AgentTool[];
  /** Optional hook called for every ledger event the plugin emits. */
  onLedgerEvent?: (event: LedgerHookEvent) => void | Promise<void>;
}

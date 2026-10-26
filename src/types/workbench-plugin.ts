import type React from 'react';

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>, context: ExecutionContext) => Promise<unknown>;
}

export interface LedgerHookEvent {
  action: string;
  assetId: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

export interface ExecutionContext {
  workspaceId: string;
  agentId: string;
  emitLedgerEvent: (event: LedgerHookEvent) => Promise<string>; // Returns transaction/hash ID
}

export interface WorkbenchPlugin {
  id: string; // e.g., 'music-studio', 'diagnostics-safety'
  name: string;
  version: string;
  registerTools: () => AgentTool[];
  onLedgerEvent?: (event: LedgerHookEvent) => Promise<void>;
  renderPanel: React.ComponentType<{ workspaceId: string }>;
}

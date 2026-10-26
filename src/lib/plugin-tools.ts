import { workbenchRegistry } from '@/plugins';
import type { AgentTool } from '@/types/workbench-plugin';

export interface PluginToolDescriptor {
  pluginId: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** Thin wrapper for agents: every registered plugin tool, with its plugin id. */
export function listPluginTools(): PluginToolDescriptor[] {
  return workbenchRegistry.listPlugins().flatMap((p) =>
    p.registerTools().map((t) => ({
      pluginId: p.id,
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    })),
  );
}

/** The executable tools (for in-process callers such as an agent runtime). */
export function getPluginAgentTools(): AgentTool[] {
  return workbenchRegistry.getAllTools();
}

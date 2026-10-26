import { listPluginTools } from '@/lib/plugin-tools';
import { executePluginTool } from '@/lib/plugin-exec';

/** MCP tool name for a plugin tool: `<pluginId>__<toolName>`, e.g. `music-studio__create_music_asset`. */
export const pluginMcpName = (pluginId: string, toolName: string) => `${pluginId}__${toolName}`;

export function pluginMcpTools() {
  return listPluginTools().map((t) => ({
    name: pluginMcpName(t.pluginId, t.name),
    description: `[plugin ${t.pluginId}] ${t.description}`,
    inputSchema: t.parameters,
  }));
}

/** Resolves an MCP tool name to a registered plugin tool, or null (so the Level 4 handler keeps its own names). */
export function resolvePluginTool(name: string): { pluginId: string; toolName: string } | null {
  const hit = listPluginTools().find((t) => pluginMcpName(t.pluginId, t.name) === name);
  return hit ? { pluginId: hit.pluginId, toolName: hit.name } : null;
}

type Id = string | number | null;

/** Runs a plugin tool for an MCP tools/call and wraps the outcome as a JSON-RPC response body. */
export async function callPluginViaMcp(req: Request, id: Id, target: { pluginId: string; toolName: string }, args: Record<string, unknown>) {
  const out = await executePluginTool(req, { ...target, args, agentId: 'mcp' });
  const data = out.ok
    ? { result: out.result, ledgerTxHashes: out.ledgerTxHashes, ledgerRecords: out.ledgerRecords }
    : { error: out.error, ledgerTxHashes: out.ledgerTxHashes, ledgerRecords: out.ledgerRecords };
  return {
    jsonrpc: '2.0',
    id,
    result: { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data, isError: !out.ok },
  };
}

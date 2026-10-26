import { workbenchRegistry } from '@/plugins';
import { commitLedgerEvent } from '@/lib/ledger-commit';
import { allowLedgerWrite } from '@/lib/ledger-guard';
import type { AssetDomain, LedgerEventPayload } from '@/types/ledger';
import type { ExecutionContext, LedgerHookEvent } from '@/types/workbench-plugin';

const DOMAINS: AssetDomain[] = ['MUSIC_TRACK', 'STEM', 'DIAGNOSTIC_AUDIT', 'AGENT_COMPUTE'];

export interface PluginExecOutcome {
  ok: boolean;
  status: number;
  pluginId?: string;
  toolName?: string;
  result?: unknown;
  error?: string;
  /** txHash of every ledger event the tool emitted, in order. */
  ledgerTxHashes: string[];
  /** Full ledger records (txHash, previousHash, signatureStatus, settlement...) in the same order. */
  ledgerRecords: unknown[];
}

/**
 * Runs a registered plugin tool server-side. Shared by the HTTP execute route and the MCP bridge so both
 * go through the same registry lookup, rate limit and ledger commit. Only registered tools can run.
 */
export async function executePluginTool(
  req: Request,
  input: { pluginId: string; toolName: string; args: Record<string, unknown>; workspaceId?: string; agentId?: string },
): Promise<PluginExecOutcome> {
  const empty = { ledgerTxHashes: [] as string[], ledgerRecords: [] as unknown[] };
  const plugin = workbenchRegistry.getPlugin(input.pluginId);
  if (!plugin) return { ok: false, status: 404, error: `unknown plugin: ${input.pluginId}`, ...empty };
  const tool = plugin.registerTools().find((t) => t.name === input.toolName);
  if (!tool) return { ok: false, status: 404, error: `unknown tool: ${input.toolName}`, ...empty };

  const txHashes: string[] = [];
  const records: unknown[] = [];
  let limited = false;
  const context: ExecutionContext = {
    workspaceId: input.workspaceId || 'default',
    agentId: input.agentId || 'http',
    emitLedgerEvent: async (event: LedgerHookEvent) => {
      if (!DOMAINS.includes(event.action as AssetDomain)) throw new Error(`ledger action must be one of ${DOMAINS.join(', ')}`);
      if (!(await allowLedgerWrite(req))) {
        limited = true;
        throw new Error('rate limit: too many ledger writes from this address, try later');
      }
      const p = event.payload as Partial<LedgerEventPayload['stateData']>;
      const res = await commitLedgerEvent(
        {
          domain: event.action as AssetDomain,
          assetId: event.assetId,
          timestamp: event.timestamp,
          stateData: {
            title: p.title,
            duration: p.duration,
            splitRule: p.splitRule,
            auditStatus: p.auditStatus,
            metadataHash: p.metadataHash as string,
          },
        },
        {
          serverSign: true,
          settlementRail: typeof event.payload.settlementRail === 'string' ? event.payload.settlementRail : undefined,
          settlementAmountCents: typeof event.payload.settlementAmountCents === 'number' ? event.payload.settlementAmountCents : undefined,
          settlementCurrency: typeof event.payload.settlementCurrency === 'string' ? event.payload.settlementCurrency : undefined,
        },
      );
      if (!res.ok) throw new Error(res.error);
      txHashes.push(res.response.txHash);
      records.push(res.response);
      await workbenchRegistry.dispatchLedgerEvent(event);
      return res.response.txHash;
    },
  };

  try {
    const result = await tool.execute(input.args, context);
    return { ok: true, status: 200, pluginId: plugin.id, toolName: tool.name, result, ledgerTxHashes: txHashes, ledgerRecords: records };
  } catch (e) {
    return {
      ok: false,
      status: limited ? 429 : 500,
      error: e instanceof Error ? e.message : 'tool failed',
      ledgerTxHashes: txHashes,
      ledgerRecords: records,
    };
  }
}

import { NextResponse } from 'next/server';
import { workbenchRegistry } from '@/plugins';
import { commitLedgerEvent } from '@/lib/ledger-commit';
import { allowLedgerWrite } from '@/lib/ledger-guard';
import type { AssetDomain, LedgerEventPayload } from '@/types/ledger';
import type { ExecutionContext, LedgerHookEvent } from '@/types/workbench-plugin';

export const dynamic = 'force-dynamic';

const DOMAINS: AssetDomain[] = ['MUSIC_TRACK', 'STEM', 'DIAGNOSTIC_AUDIT', 'AGENT_COMPUTE'];
const MAX_BODY = 10_000;

/**
 * Executes a registered plugin tool by id. Only tools already registered in the workbench registry
 * can run (no arbitrary code). The context's emitLedgerEvent commits to the micro-ledger directly
 * (rate-limited per IP) and returns the txHash. For ledger events, `action` must be an AssetDomain and
 * `payload` carries the stateData fields (title, duration, splitRule, auditStatus, metadataHash).
 */
export async function POST(req: Request) {
  const text = await req.text();
  if (text.length > MAX_BODY) return NextResponse.json({ ok: false, error: 'body too large' }, { status: 413 });
  let body: { pluginId?: unknown; toolName?: unknown; args?: unknown; workspaceId?: unknown; agentId?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 });
  }
  if (typeof body.pluginId !== 'string' || typeof body.toolName !== 'string') {
    return NextResponse.json({ ok: false, error: 'pluginId and toolName are required strings' }, { status: 400 });
  }
  const args = body.args ?? {};
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    return NextResponse.json({ ok: false, error: 'args must be an object' }, { status: 400 });
  }
  const plugin = workbenchRegistry.getPlugin(body.pluginId);
  if (!plugin) return NextResponse.json({ ok: false, error: `unknown plugin: ${body.pluginId}` }, { status: 404 });
  const tool = plugin.registerTools().find((t) => t.name === body.toolName);
  if (!tool) return NextResponse.json({ ok: false, error: `unknown tool: ${body.toolName}` }, { status: 404 });

  const txHashes: string[] = [];
  let limited = false;
  const context: ExecutionContext = {
    workspaceId: typeof body.workspaceId === 'string' && body.workspaceId ? body.workspaceId : 'default',
    agentId: typeof body.agentId === 'string' && body.agentId ? body.agentId : 'http',
    emitLedgerEvent: async (event: LedgerHookEvent) => {
      if (!DOMAINS.includes(event.action as AssetDomain)) throw new Error(`ledger action must be one of ${DOMAINS.join(', ')}`);
      if (!(await allowLedgerWrite(req))) {
        limited = true;
        throw new Error('rate limit: too many ledger writes from this address, try later');
      }
      const p = event.payload as Partial<LedgerEventPayload['stateData']>;
      const res = await commitLedgerEvent({
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
      });
      if (!res.ok) throw new Error(res.error);
      txHashes.push(res.response.txHash);
      await workbenchRegistry.dispatchLedgerEvent(event);
      return res.response.txHash;
    },
  };

  try {
    const result = await tool.execute(args as Record<string, unknown>, context);
    return NextResponse.json({ ok: true, pluginId: plugin.id, toolName: tool.name, result, ledgerTxHashes: txHashes });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'tool failed', ledgerTxHashes: txHashes },
      { status: limited ? 429 : 500 },
    );
  }
}

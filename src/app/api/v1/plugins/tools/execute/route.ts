import { NextResponse } from 'next/server';
import { executePluginTool } from '@/lib/plugin-exec';

export const dynamic = 'force-dynamic';

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
  const out = await executePluginTool(req, {
    pluginId: body.pluginId,
    toolName: body.toolName,
    args: args as Record<string, unknown>,
    workspaceId: typeof body.workspaceId === 'string' ? body.workspaceId : undefined,
    agentId: typeof body.agentId === 'string' ? body.agentId : undefined,
  });
  if (!out.ok) {
    return NextResponse.json({ ok: false, error: out.error, ledgerTxHashes: out.ledgerTxHashes, ledgerRecords: out.ledgerRecords }, { status: out.status });
  }
  return NextResponse.json({
    ok: true,
    pluginId: out.pluginId,
    toolName: out.toolName,
    result: out.result,
    ledgerTxHashes: out.ledgerTxHashes,
    ledgerRecords: out.ledgerRecords,
  });
}

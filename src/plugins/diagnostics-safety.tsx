import type { WorkbenchPlugin, LedgerHookEvent } from '@/types/workbench-plugin';
import { runDiagnosticChecksDetailed } from '@/services/diagnostics-core';

let lastEvent: LedgerHookEvent | null = null;

function DiagnosticsSafetyPanel({ workspaceId }: { workspaceId: string }) {
  return (
    <div className="text-sm text-zinc-300">
      <p className="font-medium text-white">Diagnostics &amp; Safety</p>
      <p className="mt-1">Workspace: <span className="font-mono">{workspaceId}</span></p>
      <p className="mt-1 text-zinc-500">One tool: run_diagnostic_scan (mock score, commits to the micro-ledger via the execute route).</p>
    </div>
  );
}

export const diagnosticsSafetyPlugin: WorkbenchPlugin = {
  id: 'diagnostics-safety',
  name: 'Diagnostics & Safety',
  version: '0.1.0',
  registerTools: () => [
    {
      name: 'run_diagnostic_scan',
      description: 'Runs a mock copyright scan on an asset and commits a DIAGNOSTIC_AUDIT event to the ledger.',
      parameters: {
        type: 'object',
        properties: {
          assetId: { type: 'string' },
          assetType: { type: 'string', enum: ['AUDIO', 'TEXT', 'MODEL_PROMPT'] },
          contentHash: { type: 'string' },
          rawPayloadUrl: { type: 'string' },
          title: { type: 'string', description: 'Optional hint for the mock heuristics' },
          text: { type: 'string', description: 'Optional text to scan (lyrics, prompt)' },
          durationSeconds: { type: 'number' },
          splitRule: { type: 'array', items: { type: 'object', properties: { account: { type: 'string' }, percentage: { type: 'number' } }, required: ['account', 'percentage'] } },
        },
        required: ['assetId', 'assetType', 'contentHash'],
      },
      // Server-safe: scans with the shared mock checks and commits through context.emitLedgerEvent.
      execute: async (args, context) => {
        const { result, reasons } = runDiagnosticChecksDetailed({
          assetId: String(args.assetId),
          assetType: args.assetType as 'AUDIO' | 'TEXT' | 'MODEL_PROMPT',
          contentHash: String(args.contentHash),
          rawPayloadUrl: typeof args.rawPayloadUrl === 'string' ? args.rawPayloadUrl : undefined,
          metadata: {
            title: typeof args.title === 'string' ? args.title : undefined,
            text: typeof args.text === 'string' ? args.text : undefined,
            durationSeconds: typeof args.durationSeconds === 'number' ? args.durationSeconds : undefined,
          },
        });
        const txHash = await context.emitLedgerEvent({
          action: 'DIAGNOSTIC_AUDIT',
          assetId: result.assetId,
          payload: {
            ...(Array.isArray(args.splitRule) ? { splitRule: args.splitRule } : {}),
            auditStatus: result.overallStatus === 'PASSED' ? 'PASSED' : 'FAILED',
            metadataHash: result.certificateHash,
          },
          timestamp: result.timestamp,
        });
        return { ...result, reasons, txHash };
      },
    },
  ],
  onLedgerEvent: async (event) => {
    lastEvent = event;
  },
  renderPanel: DiagnosticsSafetyPanel,
};

export const getLastDiagnosticsLedgerEvent = () => lastEvent;

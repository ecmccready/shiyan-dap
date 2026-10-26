import type { WorkbenchPlugin, LedgerHookEvent } from '@/types/workbench-plugin';
import { executeDiagnosticScan } from '@/services/diagnostics-engine';

let lastEvent: LedgerHookEvent | null = null;

function DiagnosticsSafetyPanel({ workspaceId }: { workspaceId: string }) {
  return (
    <div className="text-sm text-zinc-300">
      <p className="font-medium text-white">Diagnostics &amp; Safety</p>
      <p className="mt-1">Workspace: <span className="font-mono">{workspaceId}</span></p>
      <p className="mt-1 text-zinc-500">Stub plugin. One tool: run_diagnostic_scan (mock score, commits to the micro-ledger).</p>
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
        },
        required: ['assetId', 'assetType', 'contentHash'],
      },
      // Browser-only for now: the scan commits via a relative fetch to /api/v1/ledger/commit.
      execute: async (args) =>
        executeDiagnosticScan({
          assetId: String(args.assetId),
          assetType: args.assetType as 'AUDIO' | 'TEXT' | 'MODEL_PROMPT',
          contentHash: String(args.contentHash),
          rawPayloadUrl: typeof args.rawPayloadUrl === 'string' ? args.rawPayloadUrl : undefined,
        }),
    },
  ],
  onLedgerEvent: async (event) => {
    lastEvent = event;
  },
  renderPanel: DiagnosticsSafetyPanel,
};

export const getLastDiagnosticsLedgerEvent = () => lastEvent;

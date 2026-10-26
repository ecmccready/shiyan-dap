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
        properties: { assetId: { type: 'string' }, title: { type: 'string' } },
        required: ['assetId'],
      },
      execute: async (args, context) =>
        executeDiagnosticScan({
          assetId: String(args.assetId),
          workspaceId: context.workspaceId,
          title: typeof args.title === 'string' ? args.title : undefined,
        }),
    },
  ],
  onLedgerEvent: async (event) => {
    lastEvent = event;
  },
  renderPanel: DiagnosticsSafetyPanel,
};

export const getLastDiagnosticsLedgerEvent = () => lastEvent;

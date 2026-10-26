import type { WorkbenchPlugin, LedgerHookEvent } from '@/types/workbench-plugin';
import AgentComputePanel from './AgentComputePanel';

let lastEvent: LedgerHookEvent | null = null;

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Third domain plugin (AGENT_COMPUTE): records an agent's compute usage on the micro-ledger. */
export const agentComputePlugin: WorkbenchPlugin = {
  id: 'agent-compute',
  name: 'Agent Compute',
  version: '0.1.0',
  registerTools: () => [
    {
      name: 'record_compute_usage',
      description:
        'Records an agent compute-usage record as an AGENT_COMPUTE event on the micro-ledger and returns its assetId and txHash. Usage is self-reported, not metered.',
      parameters: {
        type: 'object',
        properties: {
          model: { type: 'string', description: 'Model or job name' },
          tokens: { type: 'number', description: 'Tokens used (positive)' },
          computeSeconds: { type: 'number', description: 'Wall-clock compute seconds (optional)' },
          assetId: { type: 'string', description: 'Optional stable id to chain several records for one agent or job' },
        },
        required: ['model', 'tokens'],
      },
      execute: async (args, context) => {
        const model = String(args.model ?? '').trim();
        const tokens = Number(args.tokens);
        if (!model || model.length > 80) throw new Error('model is required (max 80 characters)');
        if (!Number.isFinite(tokens) || tokens <= 0 || tokens > 1e12) throw new Error('tokens must be a positive number');
        const seconds = Number(args.computeSeconds);
        const computeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
        const assetId = typeof args.assetId === 'string' && args.assetId ? args.assetId : `cmp_${crypto.randomUUID().slice(0, 8)}`;
        const timestamp = Date.now();
        const metadataHash = await sha256Hex(JSON.stringify({ assetId, agentId: context.agentId, model, tokens, computeSeconds, timestamp }));
        const summary = `${model}: ${tokens} tokens${computeSeconds ? `, ${computeSeconds}s` : ''} (agent ${context.agentId})`;
        const txHash = await context.emitLedgerEvent({
          action: 'AGENT_COMPUTE',
          assetId,
          payload: { title: summary.slice(0, 200), duration: computeSeconds, metadataHash },
          timestamp,
        });
        return { assetId, summary, txHash };
      },
    },
  ],
  onLedgerEvent: async (event) => {
    lastEvent = event;
  },
  renderPanel: AgentComputePanel,
};

export const getLastComputeLedgerEvent = () => lastEvent;

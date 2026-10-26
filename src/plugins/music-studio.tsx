import type { WorkbenchPlugin, LedgerHookEvent } from '@/types/workbench-plugin';
import MusicStudioPanel from './MusicStudioPanel';

let lastEvent: LedgerHookEvent | null = null;

export const musicStudioPlugin: WorkbenchPlugin = {
  id: 'music-studio',
  name: 'Music Studio',
  version: '0.1.0',
  registerTools: () => [
    {
      name: 'describe_track',
      description: 'Returns a one-line description of a track from its title and duration.',
      parameters: {
        type: 'object',
        properties: { title: { type: 'string' }, durationSeconds: { type: 'number' } },
        required: ['title'],
      },
      execute: async (args) => `${String(args.title ?? 'Untitled')} (${Number(args.durationSeconds) || 0}s)`,
    },
    {
      name: 'register_track',
      description: 'Registers a track on the micro-ledger (MUSIC_TRACK event) and returns its assetId and txHash.',
      parameters: {
        type: 'object',
        properties: { title: { type: 'string' }, durationSeconds: { type: 'number' }, assetId: { type: 'string' } },
        required: ['title'],
      },
      execute: async (args, context) => {
        const title = String(args.title);
        const duration = Number(args.durationSeconds) || undefined;
        const assetId = typeof args.assetId === 'string' && args.assetId ? args.assetId : `trk_${crypto.randomUUID().slice(0, 8)}`;
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ assetId, title, duration })));
        const metadataHash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
        const txHash = await context.emitLedgerEvent({
          action: 'MUSIC_TRACK',
          assetId,
          payload: { title, duration, metadataHash },
          timestamp: Date.now(),
        });
        return { assetId, title, txHash };
      },
    },
  ],
  onLedgerEvent: async (event) => {
    lastEvent = event;
  },
  renderPanel: MusicStudioPanel,
};

export const getLastMusicLedgerEvent = () => lastEvent;

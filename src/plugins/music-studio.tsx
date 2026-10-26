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
  ],
  onLedgerEvent: async (event) => {
    lastEvent = event;
  },
  renderPanel: MusicStudioPanel,
};

export const getLastMusicLedgerEvent = () => lastEvent;

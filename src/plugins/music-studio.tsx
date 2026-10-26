import type { WorkbenchPlugin, LedgerHookEvent } from '@/types/workbench-plugin';

let lastEvent: LedgerHookEvent | null = null;

function MusicStudioPanel({ workspaceId }: { workspaceId: string }) {
  return (
    <div className="text-sm text-zinc-300">
      <p className="font-medium text-white">Music Studio</p>
      <p className="mt-1">Workspace: <span className="font-mono">{workspaceId}</span></p>
      <p className="mt-1 text-zinc-500">Stub plugin. One tool: describe_track.</p>
    </div>
  );
}

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

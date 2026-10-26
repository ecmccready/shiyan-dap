'use client';

import { useState } from 'react';
import { workbenchRegistry } from '@/plugins';
import LedgerProvenancePanel from './LedgerProvenancePanel';
import WorkbenchStatus from './WorkbenchStatus';

export default function WorkbenchPluginPanels({ workspaceId }: { workspaceId: string }) {
  const plugins = workbenchRegistry.listPlugins();
  const [active, setActive] = useState<string | null>(plugins[0]?.id ?? null);
  const current = plugins.find((p) => p.id === active);
  const Panel = current?.renderPanel;

  return (
    <section data-workbench-plugins className="mt-8 rounded-3xl border border-zinc-800 p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">Plugins</p>
      {plugins.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-400">No plugins registered.</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {plugins.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActive(p.id)}
                className={`rounded-full border px-3 py-1 text-xs ${p.id === active ? 'border-emerald-400 text-emerald-300' : 'border-zinc-700 text-zinc-400'}`}
              >
                {p.name} · v{p.version}
              </button>
            ))}
          </div>
          <div className="mt-4">{Panel ? <Panel workspaceId={workspaceId} /> : null}</div>
        </>
      )}
      <WorkbenchStatus />
      <LedgerProvenancePanel />
    </section>
  );
}

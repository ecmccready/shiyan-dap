import { ReactNode, Suspense } from 'react';

export default function WorkbenchLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950">
      <Suspense fallback={<div className="p-8 text-zinc-500">Loading workbench…</div>}>
        {children}
      </Suspense>
    </div>
  );
}

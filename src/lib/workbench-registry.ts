import type { AgentTool, WorkbenchPlugin } from '@/types/workbench-plugin';

export class WorkbenchRegistry {
  private plugins = new Map<string, WorkbenchPlugin>();

  /** Registers a plugin. Re-registering the same id replaces it (safe under hot reload). */
  registerPlugin(plugin: WorkbenchPlugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  unregisterPlugin(id: string): boolean {
    return this.plugins.delete(id);
  }

  getPlugin(id: string): WorkbenchPlugin | undefined {
    return this.plugins.get(id);
  }

  listPlugins(): WorkbenchPlugin[] {
    return Array.from(this.plugins.values());
  }

  /** Every tool from every plugin. */
  getAllTools(): AgentTool[] {
    return this.listPlugins().flatMap((p) => p.registerTools());
  }

  /** Delivers a ledger event to every plugin that listens for one. */
  async dispatchLedgerEvent(event: Parameters<NonNullable<WorkbenchPlugin['onLedgerEvent']>>[0]): Promise<void> {
    await Promise.all(this.listPlugins().map((p) => p.onLedgerEvent?.(event)));
  }
}

export const workbenchRegistry = new WorkbenchRegistry();

import type { AgentTool, WorkbenchPlugin } from "@/types/workbench-plugin";

export class WorkbenchRegistry {
  private plugins = new Map<string, WorkbenchPlugin>();

  register(plugin: WorkbenchPlugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Workbench plugin already registered: ${plugin.id}`);
    }
    this.plugins.set(plugin.id, plugin);
  }

  unregister(id: string): boolean {
    return this.plugins.delete(id);
  }

  get(id: string): WorkbenchPlugin | undefined {
    return this.plugins.get(id);
  }

  list(): WorkbenchPlugin[] {
    return Array.from(this.plugins.values());
  }

  listByDomain(domain: WorkbenchPlugin["domain"]): WorkbenchPlugin[] {
    return this.list().filter((p) => p.domain === domain);
  }

  /** All tools across plugins, keyed as `${pluginId}.${toolName}`. */
  getTools(): Array<{ key: string; tool: AgentTool; pluginId: string }> {
    return this.list().flatMap((p) =>
      p.tools.map((tool) => ({ key: `${p.id}.${tool.name}`, tool, pluginId: p.id })),
    );
  }
}

export const workbenchRegistry = new WorkbenchRegistry();

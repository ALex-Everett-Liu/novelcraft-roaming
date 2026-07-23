import type { Database } from "bun:sqlite";
import type { MainPlugin, PluginManifest } from "./PluginManifest";
import { MainPluginContext } from "./PluginContext";
import { EventBus, CoreEvents } from "./EventBus";
import { RpcHandlerRegistry } from "./RpcHandlerRegistry";
import { resolveDependencies } from "./DependencyResolver";
import type { PluginInfo } from "../../shared/types";

export class PluginManager {
  private manifests = new Map<string, PluginManifest>();
  private plugins = new Map<string, MainPlugin>();
  private loadedPlugins = new Set<string>();
  private enabledPlugins = new Set<string>();

  readonly eventBus = new EventBus();
  readonly rpcRegistry = new RpcHandlerRegistry();

  private sendMessage: (channel: string, payload: unknown) => void = () => {};

  constructor(private db: Database) {
    this.initDb(db);
  }

  setSendMessage(fn: (channel: string, payload: unknown) => void): void {
    this.sendMessage = fn;
  }

  private initDb(database: Database) {
    database.run(`
      CREATE TABLE IF NOT EXISTS _plugin_state (
        plugin_id TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 1
      )
    `);
    this.loadEnabledState();
  }

  async unloadAllForRestore(): Promise<void> {
    for (const pluginId of [...this.loadedPlugins].reverse()) {
      const plugin = this.plugins.get(pluginId);
      if (plugin?.onUnload) await plugin.onUnload();
      this.rpcRegistry.removeByPlugin(pluginId);
      this.loadedPlugins.delete(pluginId);
    }
  }

  async reloadWithNewDatabase(newDb: Database): Promise<void> {
    this.db = newDb;
    this.initDb(newDb);
    const resolution = resolveDependencies(this.manifests, this.enabledPlugins);
    for (const pluginId of resolution.loadOrder) {
      if (this.enabledPlugins.has(pluginId)) await this.loadPlugin(pluginId);
    }
  }

  private loadEnabledState(): void {
    const rows = this.db.query("SELECT plugin_id, enabled FROM _plugin_state").all() as {
      plugin_id: string;
      enabled: number;
    }[];
    for (const r of rows) {
      if (r.enabled) this.enabledPlugins.add(r.plugin_id);
    }
  }

  register(plugin: MainPlugin): void {
    const { manifest } = plugin;
    this.manifests.set(manifest.id, manifest);
    this.plugins.set(manifest.id, plugin);

    const row = this.db.query("SELECT enabled FROM _plugin_state WHERE plugin_id = ?").get(manifest.id) as
      | { enabled: number }
      | null;
    if (!row) {
      const enabled = manifest.essential ?? manifest.enabledByDefault !== false ? 1 : 0;
      this.db.run("INSERT INTO _plugin_state (plugin_id, enabled) VALUES (?, ?)", [manifest.id, enabled]);
      if (enabled) this.enabledPlugins.add(manifest.id);
    }
  }

  async loadAll(): Promise<void> {
    const resolution = resolveDependencies(this.manifests, this.enabledPlugins);

    for (const u of resolution.unresolvable) {
      console.warn(`Plugin "${u.pluginId}" skipped: missing [${u.missingDeps.join(", ")}]`);
    }

    for (const pluginId of resolution.loadOrder) {
      await this.loadPlugin(pluginId);
    }

    await this.eventBus.emit(CoreEvents.APP_READY);
  }

  private async loadPlugin(pluginId: string): Promise<void> {
    if (this.loadedPlugins.has(pluginId)) return;

    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    const ctx = new MainPluginContext(
      plugin.manifest,
      this.db,
      this.eventBus,
      this.rpcRegistry,
      this.sendMessage
    );

    try {
      await plugin.onLoad(ctx);
      this.loadedPlugins.add(pluginId);
      console.log(`[NovelCraft] Loaded plugin: ${plugin.manifest.name} (${pluginId})`);
      await this.eventBus.emit(CoreEvents.PLUGIN_LOADED, pluginId);
    } catch (err) {
      console.error(`[NovelCraft] Failed to load plugin "${pluginId}":`, err);
    }
  }

  buildRpcHandlers() {
    const r = this.rpcRegistry;
    const wrap = (name: string, fn?: (p: any) => any) => {
      if (!fn) return () => Promise.resolve({ success: false, error: `Handler ${name} not registered` });
      return (params: any) => Promise.resolve(fn(params));
    };

    return {
      requests: {
        // Project
        projectCreate: (p: any) => wrap("projectCreate", r.get("projectCreate"))(p),
        projectGet: (p: any) => wrap("projectGet", r.get("projectGet"))(p),

        // Fragments
        fragmentsList: (p: any) => wrap("fragmentsList", r.get("fragmentsList"))(p),
        fragmentsGet: (p: any) => wrap("fragmentsGet", r.get("fragmentsGet"))(p),
        fragmentsCreate: (p: any) => wrap("fragmentsCreate", r.get("fragmentsCreate"))(p),
        fragmentsUpdate: (p: any) => wrap("fragmentsUpdate", r.get("fragmentsUpdate"))(p),
        fragmentsDelete: (p: any) => wrap("fragmentsDelete", r.get("fragmentsDelete"))(p),
        fragmentsReorder: (p: any) => wrap("fragmentsReorder", r.get("fragmentsReorder"))(p),

        // Chapters
        chaptersList: (p: any) => wrap("chaptersList", r.get("chaptersList"))(p),
        chaptersCreate: (p: any) => wrap("chaptersCreate", r.get("chaptersCreate"))(p),

        // Import / Export
        importTxt: (p: any) => wrap("importTxt", r.get("importTxt"))(p),

        // Config
        configGet: (p: any) => wrap("configGet", r.get("configGet"))(p),
        configSave: (p: any) => wrap("configSave", r.get("configSave"))(p),

        // Agent
        agentRun: (p: any) => wrap("agentRun", r.get("agentRun"))(p),
        agentCancel: (p: any) => wrap("agentCancel", r.get("agentCancel"))(p),

        // Workshop
        workshopStart: (p: any) => wrap("workshopStart", r.get("workshopStart"))(p),
        workshopAnswer: (p: any) => wrap("workshopAnswer", r.get("workshopAnswer"))(p),
        workshopRevise: (p: any) => wrap("workshopRevise", r.get("workshopRevise"))(p),
        workshopAccept: (p: any) => wrap("workshopAccept", r.get("workshopAccept"))(p),

        // Plugin management
        listPlugins: () => Promise.resolve({ success: true, data: this.getPluginList() }),
        enablePlugin: (p: { pluginId: string }) =>
          this.enablePlugin(p.pluginId).then((ok) => (ok ? { success: true } : { success: false, error: "Failed to enable" })),
        disablePlugin: (p: { pluginId: string }) =>
          this.disablePlugin(p.pluginId).then((ok) => (ok ? { success: true } : { success: false, error: "Failed to disable" })),
      },
    };
  }

  getPluginList(): PluginInfo[] {
    return [...this.manifests.values()].map((m) => ({
      id: m.id,
      name: m.name,
      version: m.version,
      description: m.description,
      author: m.author,
      type: m.type,
      runtime: m.runtime,
      essential: m.essential ?? false,
      enabled: this.enabledPlugins.has(m.id),
      enabledByDefault: m.enabledByDefault ?? true,
      dependencies: m.dependencies ?? [],
    }));
  }

  async enablePlugin(pluginId: string): Promise<boolean> {
    const manifest = this.manifests.get(pluginId);
    if (!manifest) return false;
    for (const depId of manifest.dependencies ?? []) {
      if (!this.loadedPlugins.has(depId)) {
        console.error(`Cannot enable "${pluginId}": dependency "${depId}" not loaded`);
        return false;
      }
    }
    this.enabledPlugins.add(pluginId);
    this.db.run("INSERT OR REPLACE INTO _plugin_state (plugin_id, enabled) VALUES (?, 1)", [pluginId]);
    await this.loadPlugin(pluginId);
    return true;
  }

  async disablePlugin(pluginId: string): Promise<boolean> {
    const manifest = this.manifests.get(pluginId);
    if (!manifest) return false;
    if (manifest.essential) {
      console.warn(`Cannot disable essential plugin "${pluginId}"`);
      return false;
    }
    for (const [, m] of this.manifests) {
      if (this.loadedPlugins.has(m.id) && m.dependencies?.includes(pluginId)) {
        console.error(`Cannot disable "${pluginId}": "${m.id}" depends on it`);
        return false;
      }
    }
    const plugin = this.plugins.get(pluginId);
    if (plugin && this.loadedPlugins.has(pluginId)) {
      try {
        if (plugin.onUnload) await plugin.onUnload();
      } catch (err) {
        console.error(`Error unloading "${pluginId}":`, err);
      }
      this.rpcRegistry.removeByPlugin(pluginId);
      this.loadedPlugins.delete(pluginId);
    }
    this.enabledPlugins.delete(pluginId);
    this.db.run("INSERT OR REPLACE INTO _plugin_state (plugin_id, enabled) VALUES (?, 0)", [pluginId]);
    await this.eventBus.emit(CoreEvents.PLUGIN_UNLOADED, pluginId);
    return true;
  }

  async shutdown(): Promise<void> {
    await this.eventBus.emit(CoreEvents.APP_WILL_QUIT);
    for (const pluginId of [...this.loadedPlugins].reverse()) {
      const plugin = this.plugins.get(pluginId);
      if (plugin?.onUnload) await plugin.onUnload();
    }
    this.loadedPlugins.clear();
  }
}

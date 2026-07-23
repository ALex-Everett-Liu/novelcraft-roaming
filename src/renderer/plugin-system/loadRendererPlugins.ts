import { EventBus } from "./EventBus";
import { CommandRegistry } from "./CommandRegistry";
import { RendererPluginContext } from "./RendererPluginContext";
import { setupActionBridge } from "./actionBridge";
import { api } from "../rpc/api";
import { store } from "../state/store";
import type { PluginManifest } from "../../shared/plugin-types";

import coreFragmentPanel from "../plugins/core-fragment-panel/index";
import coreFragmentEditor from "../plugins/core-fragment-editor/index";
import coreAgentToolbar from "../plugins/core-agent-toolbar/index";
import coreOutputPanel from "../plugins/core-output-panel/index";
import coreSettingsUi from "../plugins/core-settings-ui/index";

const RENDERER_MANIFESTS: Record<string, PluginManifest> = {
  "core-fragment-panel": coreFragmentPanel.manifest,
  "core-fragment-editor": coreFragmentEditor.manifest,
  "core-agent-toolbar": coreAgentToolbar.manifest,
  "core-output-panel": coreOutputPanel.manifest,
  "core-settings-ui": coreSettingsUi.manifest,
};

const RENDERER_PLUGINS: Record<
  string,
  { onLoad: (ctx: RendererPluginContext) => Promise<void>; onUnload?: () => Promise<void> }
> = {
  "core-fragment-panel": coreFragmentPanel,
  "core-fragment-editor": coreFragmentEditor,
  "core-agent-toolbar": coreAgentToolbar,
  "core-output-panel": coreOutputPanel,
  "core-settings-ui": coreSettingsUi,
};

let eventBus: EventBus | null = null;
let commands: CommandRegistry | null = null;
let unsubActionBridge: (() => void) | null = null;
const loadedPlugins = new Set<string>();
const pluginContexts = new Map<string, RendererPluginContext>();

async function ensureRuntime(): Promise<void> {
  if (eventBus) return;
  eventBus = new EventBus();
  commands = new CommandRegistry();
  unsubActionBridge = setupActionBridge(eventBus, store);
}

async function loadPlugin(pluginId: string): Promise<void> {
  if (loadedPlugins.has(pluginId)) return;
  await ensureRuntime();

  const plugin = RENDERER_PLUGINS[pluginId];
  if (!plugin) return;

  const ctx = new RendererPluginContext(RENDERER_MANIFESTS[pluginId], eventBus!, commands!);
  pluginContexts.set(pluginId, ctx);
  await plugin.onLoad(ctx);
  loadedPlugins.add(pluginId);
}

async function unloadPlugin(pluginId: string): Promise<void> {
  if (!loadedPlugins.has(pluginId)) return;
  const plugin = RENDERER_PLUGINS[pluginId];
  if (plugin?.onUnload) await plugin.onUnload();
  loadedPlugins.delete(pluginId);
  pluginContexts.delete(pluginId);
}

async function tearDownRuntime(): Promise<void> {
  if (loadedPlugins.size > 0) return;
  if (unsubActionBridge) {
    unsubActionBridge();
    unsubActionBridge = null;
  }
  if (commands) {
    commands.destroy();
    commands = null;
  }
  eventBus = null;
}

export async function loadRendererPlugins(): Promise<void> {
  const res = await api.listPlugins();
  if (!res.success || !res.data) return;

  const enabled = new Set(
    res.data.filter((p) => p.enabled).map((p) => p.id)
  );

  for (const id of Object.keys(RENDERER_MANIFESTS)) {
    if (enabled.has(id)) {
      await loadPlugin(id);
    } else {
      await unloadPlugin(id);
    }
  }

  await tearDownRuntime();
}

export async function syncRendererPluginState(): Promise<void> {
  await loadRendererPlugins();
}

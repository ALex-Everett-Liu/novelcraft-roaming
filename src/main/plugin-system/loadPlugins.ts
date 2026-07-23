import type { MainPlugin } from "./PluginManifest";
import coreDataLayer from "../plugins/core-data-layer/index";
import coreSettings from "../plugins/core-settings/index";
import coreLlmClient from "../plugins/core-llm-client/index";
import coreAgentEngine from "../plugins/core-agent-engine/index";

const MAIN_PLUGINS: Record<string, MainPlugin> = {
  "core-data-layer": coreDataLayer,
  "core-settings": coreSettings,
  "core-llm-client": coreLlmClient,
  "core-agent-engine": coreAgentEngine,
};

export async function loadMainPlugins(): Promise<MainPlugin[]> {
  return Object.values(MAIN_PLUGINS);
}

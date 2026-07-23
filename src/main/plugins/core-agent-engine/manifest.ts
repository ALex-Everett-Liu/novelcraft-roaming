import type { PluginManifest } from "../../plugin-system/PluginManifest";

export const manifest: PluginManifest = {
  id: "core-agent-engine",
  name: "Core: Agent Engine",
  version: "1.0.0",
  description: "8 creative writing agent modes with LLM streaming",
  author: "NovelCraft Team",
  type: "core",
  runtime: "main",
  essential: true,
  enabledByDefault: true,
  dependencies: ["core-data-layer", "core-llm-client"],
};

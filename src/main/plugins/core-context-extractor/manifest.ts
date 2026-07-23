import type { PluginManifest } from "../../plugin-system/PluginManifest";

export const manifest: PluginManifest = {
  id: "core-context-extractor",
  name: "Core: Context Extractor",
  version: "1.0.0",
  description: "14-dim protagonist profile + 7-dim world ontology extraction with batched LLM analysis",
  author: "NovelCraft Team",
  type: "core",
  runtime: "main",
  essential: false,
  enabledByDefault: true,
  dependencies: ["core-data-layer", "core-llm-client"],
};

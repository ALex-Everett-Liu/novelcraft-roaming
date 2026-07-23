import type { PluginManifest } from "../../plugin-system/PluginManifest";

export const manifest: PluginManifest = {
  id: "core-llm-client",
  name: "Core: LLM Client",
  version: "1.0.0",
  description: "OpenAI-compatible SSE streaming HTTP client",
  author: "NovelCraft Team",
  type: "core",
  runtime: "main",
  essential: true,
  enabledByDefault: true,
  dependencies: [],
};

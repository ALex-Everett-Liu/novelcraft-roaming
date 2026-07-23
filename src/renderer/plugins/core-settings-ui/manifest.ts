import type { PluginManifest } from "../../../shared/plugin-types";

export const manifest: PluginManifest = {
  id: "core-settings-ui",
  name: "Core: Settings UI",
  version: "1.0.0",
  description: "Settings dialog for LLM config and theme",
  author: "NovelCraft Team",
  type: "core",
  runtime: "renderer",
  essential: false,
  enabledByDefault: true,
  dependencies: [],
};

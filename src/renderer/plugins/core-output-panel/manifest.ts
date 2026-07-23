import type { PluginManifest } from "../../../shared/plugin-types";

export const manifest: PluginManifest = {
  id: "core-output-panel",
  name: "Core: Output Panel",
  version: "1.0.0",
  description: "Right panel content: streaming output display",
  author: "NovelCraft Team",
  type: "core",
  runtime: "renderer",
  essential: false,
  enabledByDefault: true,
  dependencies: [],
};

import type { PluginManifest } from "../../../shared/plugin-types";

export const manifest: PluginManifest = {
  id: "core-agent-toolbar",
  name: "Core: Agent Toolbar",
  version: "1.0.0",
  description: "Right panel toolbar: 8 agent mode buttons",
  author: "NovelCraft Team",
  type: "core",
  runtime: "renderer",
  essential: true,
  enabledByDefault: true,
  dependencies: [],
};

import type { PluginManifest } from "../../plugin-system/PluginManifest";

export const manifest: PluginManifest = {
  id: "core-settings",
  name: "Core: Settings",
  version: "1.0.0",
  description: "Application configuration storage with encryption",
  author: "NovelCraft Team",
  type: "core",
  runtime: "main",
  essential: true,
  enabledByDefault: true,
  dependencies: ["core-data-layer"],
};

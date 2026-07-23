import type { PluginManifest } from "../../plugin-system/PluginManifest";

export const manifest: PluginManifest = {
  id: "core-data-layer",
  name: "Core: Data Layer",
  version: "1.0.0",
  description: "Fragment, Chapter, and Project CRUD operations with SQLite storage",
  author: "NovelCraft Team",
  type: "core",
  runtime: "main",
  essential: true,
  enabledByDefault: true,
  dependencies: [],
};

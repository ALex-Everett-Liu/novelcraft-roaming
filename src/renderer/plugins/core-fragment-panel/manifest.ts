import type { PluginManifest } from "../../../shared/plugin-types";

export const manifest: PluginManifest = {
  id: "core-fragment-panel",
  name: "Core: Fragment Panel",
  version: "1.0.0",
  description: "Left panel: fragment list, selection, add/delete",
  author: "NovelCraft Team",
  type: "core",
  runtime: "renderer",
  essential: true,
  enabledByDefault: true,
  dependencies: [],
};

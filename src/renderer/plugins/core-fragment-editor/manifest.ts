import type { PluginManifest } from "../../../shared/plugin-types";

export const manifest: PluginManifest = {
  id: "core-fragment-editor",
  name: "Core: Fragment Editor",
  version: "1.0.0",
  description: "Center panel: fragment content editing with auto-save",
  author: "NovelCraft Team",
  type: "core",
  runtime: "renderer",
  essential: true,
  enabledByDefault: true,
  dependencies: [],
};

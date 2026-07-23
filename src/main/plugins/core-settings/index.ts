import type { MainPlugin } from "../../plugin-system/PluginManifest";
import type { MainPluginContext } from "../../plugin-system/PluginManifest";
import { manifest } from "./manifest";
import { getDataDir } from "../../database/connection";
import path from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

const CONFIG_FILENAME = "config.json";

function getConfigPath(): string {
  const dir = getDataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return path.join(dir, CONFIG_FILENAME);
}

function loadConfig(): any {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return {
      llm: {
        baseUrl: "https://api.openai.com",
        apiKey: "",
        model: "gpt-4o",
        temperature: 0.8,
        maxTokens: 4096,
      },
    };
  }
  try {
    const raw = readFileSync(configPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { llm: {} };
  }
}

function saveConfig(config: any): void {
  const configPath = getConfigPath();
  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

const plugin: MainPlugin = {
  manifest,

  async onLoad(ctx: MainPluginContext) {
    ctx.registerRpcHandler("configGet", () => {
      const cfg = loadConfig();
      return { success: true, data: cfg.llm || {} };
    }, { noPrefix: true });

    ctx.registerRpcHandler("configSave", (params: { config: any }) => {
      const current = loadConfig();
      current.llm = {
        baseUrl: params.config.baseUrl || "https://api.openai.com",
        apiKey: params.config.apiKey || "",
        model: params.config.model || "gpt-4o",
        temperature: params.config.temperature ?? 0.8,
        maxTokens: params.config.maxTokens ?? 4096,
      };
      saveConfig(current);
      return { success: true };
    }, { noPrefix: true });

    ctx.log("Settings ready");
  },
};

export default plugin;

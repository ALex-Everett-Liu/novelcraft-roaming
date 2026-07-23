export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  type: "core" | "community";
  runtime: "main" | "renderer" | "both";
  dependencies?: string[];
  softDependencies?: string[];
  essential?: boolean;
  enabledByDefault?: boolean;
  minAppVersion?: string;
}

export interface MainPlugin {
  manifest: PluginManifest;
  onLoad(context: MainPluginContext): Promise<void>;
  onUnload?(): Promise<void>;
}

import type { Database } from "bun:sqlite";

export interface MainPluginContext {
  pluginId: string;
  getDatabase(): Database;
  runMigration(version: number, name: string, sql: string): void;
  registerRpcHandler(
    name: string,
    handler: (params: any) => any | Promise<any>,
    options?: { noPrefix?: boolean }
  ): void;
  sendMessage(channel: string, payload: unknown): void;
  on(event: string, handler: (...args: any[]) => void): () => void;
  emit(event: string, ...args: any[]): Promise<void>;
  log(...args: any[]): void;
}

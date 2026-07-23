import type { PluginManifest } from "./PluginManifest";

export interface RendererPluginContext {
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
  registerCommand(command: RendererCommand): void;
  unregisterAllCommands(): void;
  listCommands(): RendererCommand[];
}

export interface RendererCommand {
  id: string;
  name: string;
  shortcut?: string;
  category?: string;
  keywords?: string[];
  execute: () => void;
}

export interface RendererPlugin {
  manifest: PluginManifest;
  onLoad(context: RendererPluginContext): Promise<void>;
  onUnload?(): Promise<void>;
}

export type { PluginManifest };

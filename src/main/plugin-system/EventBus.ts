export type EventHandler = (...args: any[]) => void | Promise<void>;

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  on(event: string, handler: EventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => this.handlers.get(event)?.delete(handler);
  }

  async emit(event: string, ...args: any[]): Promise<void> {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const h of set) {
      await h(...args);
    }
  }

  removeHandler(handler: EventHandler): void {
    for (const set of this.handlers.values()) {
      set.delete(handler);
    }
  }
}

export const CoreEvents = {
  FRAGMENT_CREATED: "fragment:created",
  FRAGMENT_UPDATED: "fragment:updated",
  FRAGMENT_DELETED: "fragment:deleted",
  CHAPTER_CREATED: "chapter:created",
  PROJECT_LOADED: "project:loaded",
  PLUGIN_LOADED: "plugin:loaded",
  PLUGIN_UNLOADED: "plugin:unloaded",
  APP_READY: "app:ready",
  APP_WILL_QUIT: "app:will-quit",
} as const;

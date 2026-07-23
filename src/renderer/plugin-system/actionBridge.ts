import type { EventBus } from "./EventBus";

export interface ActionBridgeStore {
  getState(): any;
  createFragment(parentId?: string): Promise<any>;
  updateFragment(id: string, updates: Record<string, any>): Promise<any>;
  deleteFragment(id: string): Promise<any>;
  selectFragment(id: string, multi?: boolean): void;
}

export function setupActionBridge(eventBus: EventBus, store: ActionBridgeStore): () => void {
  const unsubs: Array<() => void> = [];

  unsubs.push(
    eventBus.on("action:createFragment", async () => {
      await store.createFragment();
    })
  );

  unsubs.push(
    eventBus.on("action:deleteFragment", async (fragmentId: unknown) => {
      await store.deleteFragment(String(fragmentId));
    })
  );

  unsubs.push(
    eventBus.on("action:selectFragment", (fragmentId: unknown) => {
      store.selectFragment(String(fragmentId), false);
    })
  );

  unsubs.push(
    eventBus.on("action:toggleSelectFragment", (fragmentId: unknown) => {
      store.selectFragment(String(fragmentId), true);
    })
  );

  return () => {
    for (const unsub of unsubs) unsub();
  };
}

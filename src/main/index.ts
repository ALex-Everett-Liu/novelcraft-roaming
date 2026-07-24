import Electrobun, { BrowserWindow, BrowserView } from "electrobun/bun";
import { getDatabase, closeDatabase, ensureBackup, restoreFromBackup, commitSave, hasBackup } from "./database/connection";
import { PluginManager } from "./plugin-system/PluginManager";
import { loadMainPlugins } from "./plugin-system/loadPlugins";

const db = getDatabase();

const pluginManager = new PluginManager(db);

const mainPlugins = await loadMainPlugins();
for (const plugin of mainPlugins) {
  pluginManager.register(plugin);
}

// Set up sendMessage BEFORE loading plugins so ctx.sendMessage() works
let rpcSend: (channel: string, payload: unknown) => void = (channel, payload) => {
  console.warn("[NovelCraft] RPC not ready, dropping message:", channel);
};
pluginManager.setSendMessage((channel, payload) => rpcSend(channel, payload));

await pluginManager.loadAll();

console.log("[NovelCraft] Plugins loaded. Loaded set:", [...(pluginManager as any).loadedPlugins]);

let hasUnsavedChanges = false;
let userConfirmedQuitDespiteUnsaved = false;

const baseHandlers = pluginManager.buildRpcHandlers();
const handlerKeys = Object.keys(baseHandlers.requests);
console.log("[NovelCraft] RPC handlers registered:", handlerKeys.join(", "));
const mutatingOps = [
  "projectCreate",
  "fragmentsCreate", "fragmentsUpdate", "fragmentsDelete", "fragmentsReorder",
  "chaptersCreate",
  "importTxt",
  "configSave",
  "agentRun",
  "workshopStart", "workshopAnswer", "workshopRevise", "workshopAccept",
  "protagonistExtract", "worldOntologyExtract", "bridgeExtract", "contextExtract",
  "novelProfileSave", "protagonistProfileSave", "worldOntologySave",
];

const wrapMutating = (name: string, fn: (params: unknown) => Promise<unknown>) => {
  return async (params: unknown) => {
    ensureBackup();
    return fn(params);
  };
};

const requests: Record<string, (params: unknown) => Promise<unknown>> = {
  ...(baseHandlers.requests as Record<string, (params: unknown) => Promise<unknown>>),
  reportUnsavedState: (params: unknown) => {
    hasUnsavedChanges = (params as { hasUnsaved: boolean }).hasUnsaved;
    return Promise.resolve();
  },
  commitSave: async () => {
    commitSave();
    return Promise.resolve({ success: true });
  },
  restoreFromBackup: async () => {
    console.log("[NovelCraft] restoreFromBackup RPC handler called");
    await pluginManager.unloadAllForRestore();
    const result = restoreFromBackup();
    if (result.success) {
      try {
        await pluginManager.reloadWithNewDatabase(getDatabase());
      } catch (e) {
        console.error("[NovelCraft] Plugin reload after restore failed:", e);
        return { success: false, error: String(e) };
      }
    }
    return { success: result.success, error: result.error };
  },
  hasBackup: () => Promise.resolve({ success: true, data: hasBackup() }),
};

for (const name of mutatingOps) {
  const fn = requests[name];
  if (fn) requests[name] = wrapMutating(name, fn);
}

const novelcraftRPC = BrowserView.defineRPC({
  maxRequestTime: 60000,
  handlers: {
    requests,
    messages: {
      streamChunk: () => {},
      streamDone: () => {},
      streamError: () => {},
      workshopStateChanged: () => {},
      extractionChunk: () => {},
      extractionDone: () => {},
      extractionError: () => {},
      extractionProgress: () => {},
    },
  },
});

// Wire rpcSend to use novelcraftRPC.send()
rpcSend = (channel, payload) => {
  try {
    console.log("[sendMessage]", channel);
    (novelcraftRPC as any).send(channel, payload);
  } catch (e) {
    console.warn("[NovelCraft] Failed to send message:", channel, e);
  }
};

const mainWindow = new BrowserWindow({
  title: "NovelCraft",
  frame: { x: 0, y: 0, width: 1200, height: 800 },
  url: "views://renderer/index.html",
  rpc: novelcraftRPC,
});

Electrobun.events.on("before-quit", (event: { response?: { allow: boolean } }) => {
  if (hasUnsavedChanges && !userConfirmedQuitDespiteUnsaved) {
    event.response = { allow: false };
    Electrobun.Utils.showMessageBox({
      type: "question",
      title: "Unsaved Changes",
      message: "You have unsaved changes. Quit anyway?",
      buttons: ["Quit", "Cancel"],
      defaultId: 1,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) {
        userConfirmedQuitDespiteUnsaved = true;
        Electrobun.Utils.quit();
      }
    });
  }
});

Electrobun.events.on("will-quit", async () => {
  await pluginManager.shutdown();
  closeDatabase();
});

mainWindow.on("close", () => {
  Electrobun.Utils.quit();
});

import { render } from "preact";
import { html } from "htm/preact";
import { Electroview } from "electrobun/view";
import type { NovelCraftRPCType } from "../shared/rpc-schema";
import { initApi } from "./rpc/api";
import { App } from "./components/App";
import { store } from "./state/store";
import { loadAllRendererPluginsImmediately } from "./plugin-system/loadRendererPlugins";
import { initializeTheme } from "./theme/themeManager";
import "./styles/main.css";

// Initialize theme before first paint
initializeTheme();

// Initialize Electrobun RPC - connects to main process
const rpc = Electroview.defineRPC<NovelCraftRPCType>({
  maxRequestTime: 15000,
  handlers: {
    requests: {},
    messages: {
      streamChunk: ({ content }: { content: string }) => {
        store.appendStreamChunk(content);
      },
      streamDone: () => {
        store.markStreamComplete();
      },
      streamError: ({ message }: { message: string }) => {
        store.appendStreamChunk(`\n\n[Error: ${message}]`);
        store.markStreamComplete();
      },
      workshopStateChanged: (state: any) => {
        store.setWorkshopState(state);
      },
    },
  },
});

const electroview = new Electroview({ rpc });
initApi(electroview.rpc!.request as Parameters<typeof initApi>[0]);

// Render app immediately (shows empty/loading state)
render(html`<${App} />`, document.getElementById("app")!);

// Defer data load and plugin load - give WebSocket time to connect to main process
setTimeout(async () => {
  await store.initialLoad();
  await loadAllRendererPluginsImmediately().catch((err) =>
    console.error("[renderer plugins] Failed to load:", err)
  );
}, 300);

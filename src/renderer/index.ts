import { render } from "preact";
import { html } from "htm/preact";
import { Electroview } from "electrobun/view";
import type { NovelCraftRPCType } from "../shared/rpc-schema";
import { initApi } from "./rpc/api";
import { initializeTheme } from "./theme/themeManager";
import { App } from "./components/App";
import { loadAllRendererPluginsImmediately } from "./plugin-system/loadRendererPlugins";

initializeTheme();

const rpc = Electroview.defineRPC<NovelCraftRPCType>({
  maxRequestTime: 15000,
  handlers: {
    requests: {},
    messages: {
      streamChunk: (payload) => {
        window.dispatchEvent(new CustomEvent("stream:chunk", { detail: payload }));
      },
      streamDone: (payload) => {
        window.dispatchEvent(new CustomEvent("stream:done", { detail: payload }));
      },
      streamError: (payload) => {
        window.dispatchEvent(new CustomEvent("stream:error", { detail: payload }));
      },
      workshopStateChanged: (payload) => {
        window.dispatchEvent(new CustomEvent("workshop:state", { detail: payload }));
      },
    },
  },
});

const electroview = new Electroview({ rpc });
initApi(electroview.rpc!.request);

render(html`<${App} />`, document.getElementById("app")!);

// Load renderer plugins immediately — they're all essential for MVP
loadAllRendererPluginsImmediately().catch((err) =>
  console.error("[renderer plugins] Failed to load:", err)
);

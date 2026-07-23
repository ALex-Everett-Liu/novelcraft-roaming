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
  maxRequestTime: 60000,
  handlers: {
    requests: {},
    messages: {
      streamChunk: ({ content }: { content: string }) => {
        store.appendStreamChunk(content);
      },
      streamDone: () => {
        // Add completed stream text to workshop conversation history
        const ws = store.state.value.workshopState;
        if (ws && store.state.value.streamText) {
          const updatedHistory = [
            ...(ws.conversationHistory || []),
            { role: "agent", content: store.state.value.streamText },
          ];
          store.setWorkshopState({ ...ws, conversationHistory: updatedHistory });
          store.clearStream(); // moved to history, no longer needed in stream
        }
        store.markStreamComplete();
      },
      streamError: ({ message }: { message: string }) => {
        store.appendStreamChunk(`\n\n[Error: ${message}]`);
        store.markStreamComplete();
      },
      workshopStateChanged: (state: any) => {
        // Add agent's questions to conversation history if not already there
        if (state.questions?.length > 0 && !state.conversationHistory?.length) {
          state.conversationHistory = [{
            role: "agent",
            content: state.questions.map(
              (q: any, i: number) => `${i + 1}. ${q.section ? `_${q.section}_ ` : ""}${q.question}`
            ).join("\n\n"),
          }];
        }
        store.setWorkshopState(state);
      },
      extractionChunk: ({ type, content }: { type: string; content: string }) => {
        store.appendExtractionChunk(type, content);
      },
      extractionDone: ({ type, result, statusMessage, diff, previousProfile, snapshotPath, characterName }: { type: string; result: any; statusMessage: string; diff?: any; previousProfile?: any; snapshotPath?: string; characterName?: string }) => {
        store.completeExtraction(type, result, statusMessage, diff, previousProfile, snapshotPath, characterName);
      },
      extractionError: ({ type, message }: { type: string; message: string }) => {
        store.errorExtraction(type, message);
      },
      extractionProgress: ({ type, batch, totalBatches }: { type: string; batch: number; totalBatches: number }) => {
        store.updateExtractionProgress(type, batch, totalBatches);
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

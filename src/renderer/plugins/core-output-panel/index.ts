import { render } from "preact";
import { html } from "htm/preact";
import { useEffect, useState } from "preact/hooks";
import { store } from "../../state/store";
import type { RendererPluginContext } from "../../plugin-system/RendererPluginContext";
import { manifest } from "./manifest";

const plugin = {
  manifest,
  async onLoad(_ctx: RendererPluginContext) {
    mount();
  },
};

let container: HTMLDivElement | null = null;

function OutputPanel() {
  const streamText = store.state.value.streamText;
  const streamComplete = store.state.value.streamComplete;
  const agentMode = store.state.value.agentMode;
  const selectedIds = store.state.value.selectedFragmentIds;

  useEffect(() => {
    const handleChunk = (e: Event) => {
      store.appendStreamChunk((e as CustomEvent).detail.content);
    };
    const handleDone = () => {
      store.markStreamComplete();
    };
    const handleError = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      store.appendStreamChunk(`\n\n[Error: ${detail.message}]`);
    };

    window.addEventListener("stream:chunk", handleChunk);
    window.addEventListener("stream:done", handleDone);
    window.addEventListener("stream:error", handleError);
    return () => {
      window.removeEventListener("stream:chunk", handleChunk);
      window.removeEventListener("stream:done", handleDone);
      window.removeEventListener("stream:error", handleError);
    };
  }, []);

  const handleAccept = async () => {
    const text = streamText;
    const mode = agentMode;
    store.clearStream();
    store.setAgentMode(null);

    if (!text) return;

    if (mode === "polish" && selectedIds.length === 1) {
      store.updateFragment(selectedIds[0], { content: text });
    } else if (mode === "diverge") {
      try {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const branches = JSON.parse(jsonMatch[0]);
          if (Array.isArray(branches)) {
            for (const branch of branches) {
              const content = `# ${branch.title || "Branch"}\n\n${branch.summary || ""}\n\n${branch.opening || ""}`;
              await store.createFragment(content);
            }
          }
        }
      } catch {
        store.createFragment(text.slice(0, 500));
      }
    } else {
      store.createFragment(text);
    }
  };

  const handleReject = () => {
    store.clearStream();
    store.setAgentMode(null);
  };

  const handleCancel = () => {
    store.clearStream();
    store.setAgentMode(null);
  };

  // Show streaming text
  if (streamText && !streamComplete) {
    return html`
      <div class="output-container">
        <div class="output-content">${streamText}</div>
      </div>
    `;
  }

  // Show accept/reject after stream completes
  if (streamComplete && streamText) {
    return html`
      <div class="output-container">
        <div class="output-content">${streamText}</div>
        <div class="output-actions">
          <button class="output-btn output-btn-accept" onClick=${handleAccept}>Accept</button>
          <button class="output-btn output-btn-reject" onClick=${handleReject}>Reject</button>
        </div>
      </div>
    `;
  }

  if (!agentMode) {
    return html`<div class="output-placeholder">Select fragments and choose an agent mode</div>`;
  }

  if (!streamText) {
    return html`<div class="output-placeholder">Click "Run" to start ${agentMode} mode</div>`;
  }
}

function mount() {
  const panel = document.getElementById("panel-right-content");
  if (!panel) return;

  const placeholder = panel.querySelector(".panel-placeholder");
  if (placeholder) placeholder.remove();

  container = document.createElement("div");
  container.className = "output-panel";
  panel.appendChild(container);

  function renderOutput() {
    if (!container) return;
    render(html`<${OutputPanel} />`, container);
  }

  renderOutput();
  return () => {
    container?.remove();
    container = null;
  };
}

export default { manifest, onLoad: plugin.onLoad };

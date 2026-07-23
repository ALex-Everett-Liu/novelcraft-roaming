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
  const [, setTick] = useState(0);
  const streamText = store.state.value.streamText;
  const agentMode = store.state.value.agentMode;

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleChunk = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      store.appendStreamChunk(detail.content);
    };
    const handleDone = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      console.log("Stream done:", detail.fullText.slice(0, 100));
    };
    window.addEventListener("stream:chunk", handleChunk);
    window.addEventListener("stream:done", handleDone);
    return () => {
      window.removeEventListener("stream:chunk", handleChunk);
      window.removeEventListener("stream:done", handleDone);
    };
  }, []);

  if (!agentMode) {
    return html`<div class="output-placeholder">Select fragments and choose an agent mode</div>`;
  }

  if (!streamText) {
    return html`<div class="output-placeholder">Click "Run" to start ${agentMode} mode</div>`;
  }

  return html`
    <div class="output-container">
      <div class="output-content">${streamText}</div>
    </div>
  `;
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
  const unsubscribe = store.state.subscribe(() => renderOutput());
  return () => {
    unsubscribe();
    container?.remove();
    container = null;
  };
}

export default { manifest, onLoad: plugin.onLoad };

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

function FragmentPanel() {
  const [, setTick] = useState(0);
  const fragments = store.state.value.fragments;
  const selectedIds = store.state.value.selectedFragmentIds;

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(interval);
  }, []);

  const typeLabels: Record<string, string> = {
    scene: "S", dialogue: "D", plot: "P", lore: "L", synopsis: "Y", note: "N",
  };

  return html`
    <div class="fragment-list">
      <div class="fragment-list-header">
        <button class="fragment-add-btn" onClick=${() => store.createFragment()}>+ New Fragment</button>
      </div>
      <div class="fragment-items">
        ${fragments.length === 0
          ? html`<div class="fragment-empty">No fragments yet.</div>`
          : fragments.map(
              (f) => html`
                <div
                  class=${`fragment-item ${selectedIds.includes(f.id) ? "fragment-item-selected" : ""}`}
                  onClick=${() => store.selectFragment(f.id, false)}
                >
                  <span class="fragment-type-badge">${typeLabels[f.type] || "?"}</span>
                  <div class="fragment-item-content">
                    <div class="fragment-item-title">${f.title || "(untitled)"}</div>
                    <div class="fragment-item-preview">${f.content.slice(0, 60) || "(empty)"}</div>
                  </div>
                  <button class="fragment-delete-btn" onClick=${(e: Event) => { e.stopPropagation(); store.deleteFragment(f.id); }}>x</button>
                </div>
              `
            )}
      </div>
    </div>
  `;
}

function mount() {
  const panel = document.getElementById("panel-left");
  if (!panel) return;

  const placeholder = panel.querySelector(".panel-placeholder");
  if (placeholder) placeholder.remove();

  container = document.createElement("div");
  container.className = "fragment-panel";
  panel.appendChild(container);

  function renderPanel() {
    if (!container) return;
    render(html`<${FragmentPanel} />`, container);
  }

  renderPanel();
  const unsubscribe = store.state.subscribe(() => renderPanel());

  return () => {
    unsubscribe();
    container?.remove();
    container = null;
  };
}

export default { manifest, onLoad: plugin.onLoad };

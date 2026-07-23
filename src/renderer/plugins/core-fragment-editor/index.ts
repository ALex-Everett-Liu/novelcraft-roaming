import { render } from "preact";
import { html } from "htm/preact";
import { useEffect, useState, useRef } from "preact/hooks";
import { store } from "../../state/store";
import { debounce } from "../../utils/debounce";
import type { RendererPluginContext } from "../../plugin-system/RendererPluginContext";
import { manifest } from "./manifest";

const plugin = {
  manifest,
  async onLoad(_ctx: RendererPluginContext) {
    mount();
  },
};

let container: HTMLDivElement | null = null;

function FragmentEditor() {
  const [, setTick] = useState(0);
  const fragments = store.state.value.fragments;
  const focusedId = store.state.value.focusedFragmentId;
  const fragment = focusedId ? fragments.find((f) => f.id === focusedId) : null;

  const [title, setTitle] = useState(fragment?.title || "");
  const [content, setContent] = useState(fragment?.content || "");

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (fragment) {
      setTitle(fragment.title || "");
      setContent(fragment.content || "");
    }
  }, [focusedId]);

  const debouncedSave = useRef(
    debounce((id: string, updates: Record<string, any>) => {
      store.updateFragment(id, updates);
    }, 2000)
  ).current;

  const typeLabels: Record<string, string> = {
    scene: "Scene", dialogue: "Dialogue", plot: "Plot Idea",
    lore: "Lore", synopsis: "Synopsis", note: "Note",
  };

  if (!fragment) {
    return html`<div class="editor-empty">Select a fragment to edit</div>`;
  }

  return html`
    <div class="editor-container">
      <div class="editor-meta">
        <span class="editor-type">${typeLabels[fragment.type] || fragment.type}</span>
        <span class="editor-wordcount">${fragment.wordCount} words</span>
      </div>
      <input
        class="editor-title"
        type="text"
        value=${title}
        onInput=${(e: Event) => {
          const val = (e.target as HTMLInputElement).value;
          setTitle(val);
          if (fragment) debouncedSave(fragment.id, { title: val });
        }}
        placeholder="Fragment title..."
      />
      <textarea
        class="editor-content"
        value=${content}
        onInput=${(e: Event) => {
          const val = (e.target as HTMLTextAreaElement).value;
          setContent(val);
          if (fragment) debouncedSave(fragment.id, { content: val });
        }}
        placeholder="Write your fragment here..."
        spellcheck=${false}
      />
    </div>
  `;
}

function mount() {
  const panel = document.getElementById("panel-center");
  if (!panel) return;

  const placeholder = panel.querySelector(".panel-placeholder");
  if (placeholder) placeholder.remove();

  container = document.createElement("div");
  container.className = "fragment-editor";
  panel.appendChild(container);

  function renderEditor() {
    if (!container) return;
    render(html`<${FragmentEditor} />`, container);
  }

  renderEditor();
  const unsubscribe = store.state.subscribe(() => renderEditor());
  return () => {
    unsubscribe();
    container?.remove();
    container = null;
  };
}

export default { manifest, onLoad: plugin.onLoad };

import { html } from "htm/preact";
import { useEffect, useState } from "preact/hooks";
import { store } from "../state/store";

export function Toolbar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [hasUnsaved, setHasUnsaved] = useState(false);

  useEffect(() => {
    return store.state.subscribe((state) => {
      setHasUnsaved(state.unsavedCount > 0);
    });
  }, []);

  return html`
    <header class="toolbar">
      <div class="toolbar-title">
        <h1>NovelCraft</h1>
      </div>
      <div class="toolbar-actions">
        ${hasUnsaved &&
        html`
          <span class="toolbar-unsaved">Unsaved</span>
          <button class="toolbar-btn toolbar-btn-save" onClick=${() => store.saveAll()}>Save</button>
          <button class="toolbar-btn toolbar-btn-discard" onClick=${() => store.discardAll()}>Discard</button>
        `}
        <button class="toolbar-btn toolbar-btn-settings" onClick=${onOpenSettings}>Settings</button>
      </div>
    </header>
  `;
}

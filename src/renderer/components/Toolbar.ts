import { html } from "htm/preact";
import { useEffect, useState } from "preact/hooks";
import { store } from "../state/store";

export function Toolbar() {
  const [unsavedCount, setUnsavedCount] = useState(0);

  useEffect(() => {
    // Subscribe to state changes
    const interval = setInterval(() => {
      setUnsavedCount(store.state.value.unsavedCount);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const handleSave = () => store.saveAll();
  const handleDiscard = () => store.discardAll();

  return html`
    <header class="toolbar">
      <div class="toolbar-title">
        <h1>NovelCraft</h1>
      </div>
      <div class="toolbar-actions">
        ${unsavedCount > 0 &&
        html`
          <span class="toolbar-unsaved">${unsavedCount} unsaved</span>
          <button class="toolbar-btn toolbar-btn-save" onClick=${handleSave}>Save</button>
          <button class="toolbar-btn toolbar-btn-discard" onClick=${handleDiscard}>Discard</button>
        `}
      </div>
    </header>
  `;
}

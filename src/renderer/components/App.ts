import { html } from "htm/preact";
import { useEffect, useState } from "preact/hooks";
import { store } from "../state/store";
import { Toolbar } from "./Toolbar";

export function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    store.initialLoad().then(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (store.hasUnsavedChanges()) store.saveAll();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("novelcraft:open-settings"));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function openSettings() {
    window.dispatchEvent(new CustomEvent("novelcraft:open-settings"));
  }

  if (loading) {
    return html`<div class="loading">Loading...</div>`;
  }

  return html`
    <div class="app">
      <${Toolbar} onOpenSettings=${openSettings} />
      <main class="main-layout">
        <aside class="panel panel-left" id="panel-left">
          <div class="panel-header">Fragments</div>
          <div class="panel-placeholder">Fragment panel loading...</div>
        </aside>
        <section class="panel panel-center" id="panel-center">
          <div class="panel-header">Editor</div>
          <div class="panel-placeholder">Select a fragment to edit</div>
        </section>
        <aside class="panel panel-right" id="panel-right">
          <div class="panel-right-toolbar" id="panel-right-toolbar">
            <div class="panel-header">Agent Modes</div>
          </div>
          <div class="panel-right-content" id="panel-right-content">
            <div class="panel-placeholder">Select fragments and choose a mode</div>
          </div>
        </aside>
      </main>
    </div>
  `;
}

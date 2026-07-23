import { html } from "htm/preact";
import { useEffect, useState } from "preact/hooks";
import { store } from "../state/store";
import { api } from "../rpc/api";

async function downloadLlmLogs() {
  const res = await api.getLlmLogs();
  if (!res.success || !res.data || res.data.length === 0) {
    alert("No LLM interaction logs yet.");
    return;
  }

  const lines: string[] = [];
  for (const entry of res.data) {
    lines.push(`================================================================================`);
    lines.push(`[${entry.ts}] MODE: ${entry.mode}`);
    lines.push(`--------------------------------------------------------------------------------`);
    lines.push(`SYSTEM:`);
    lines.push(entry.system);
    lines.push(`--------------------------------------------------------------------------------`);
    lines.push(`USER PROMPT:`);
    lines.push(entry.user);
    lines.push(`--------------------------------------------------------------------------------`);
    lines.push(`RESPONSE:`);
    lines.push(entry.response);
    lines.push(``);
  }

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `novelcraft-llm-log-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

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
        <button class="toolbar-btn" onClick=${downloadLlmLogs}>LLM Logs</button>
      </div>
    </header>
  `;
}

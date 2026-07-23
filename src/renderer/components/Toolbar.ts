import { html } from "htm/preact";
import { useEffect, useState, useRef } from "preact/hooks";
import { store } from "../state/store";
import { api } from "../rpc/api";
import type { Project } from "../../shared/types";

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
  const [projectName, setProjectName] = useState("");
  const [showProjects, setShowProjects] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return store.state.subscribe((state) => {
      setHasUnsaved(state.unsavedCount > 0);
      setProjectName(state.project?.name || "");
    });
  }, []);

  useEffect(() => {
    if (!showProjects) return;
    api.projectsList().then((res) => {
      if (res.success && res.data) setProjects(res.data);
    });
    const close = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowProjects(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [showProjects]);

  return html`
    <header class="toolbar">
      <div class="toolbar-title">
        <h1>NovelCraft</h1>
        <div class="toolbar-project-wrap" ref=${dropdownRef}>
          <button class="toolbar-project-btn" onClick=${() => setShowProjects((v) => !v)}>
            ${projectName || "No Project"}
            <span class="toolbar-project-arrow">&#x25BC;</span>
          </button>
          ${showProjects && html`
            <div class="toolbar-project-dropdown">
              ${projects.map((p) => html`
                <button
                  class=${`toolbar-project-item ${p.name === projectName ? "toolbar-project-item-active" : ""}`}
                  onClick=${() => {
                    store.switchProject(p);
                    setShowProjects(false);
                  }}
                >
                  ${p.name}
                </button>
              `)}
            </div>
          `}
        </div>
      </div>
      <div class="toolbar-actions">
        ${hasUnsaved && html`
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

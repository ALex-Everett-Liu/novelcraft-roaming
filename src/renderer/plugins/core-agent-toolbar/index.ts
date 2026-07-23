import { render } from "preact";
import { html } from "htm/preact";
import { useEffect, useState } from "preact/hooks";
import { store } from "../../state/store";
import { api } from "../../rpc/api";
import type { RendererPluginContext } from "../../plugin-system/RendererPluginContext";
import { manifest } from "./manifest";
import type { AgentMode } from "../../../shared/types";

const plugin = {
  manifest,
  async onLoad(_ctx: RendererPluginContext) {
    mount();
  },
};

const MODES: { mode: AgentMode; label: string; description: string }[] = [
  { mode: "polish", label: "Polish", description: "文笔润色" },
  { mode: "bridge", label: "Bridge", description: "弥合过渡" },
  { mode: "splice", label: "Splice", description: "拼接碎片" },
  { mode: "expand", label: "Expand", description: "扩展场景" },
  { mode: "diverge", label: "Diverge", description: "发散分支" },
  { mode: "continue", label: "Continue", description: "续写后文" },
  { mode: "complete", label: "Complete", description: "完型章节" },
  { mode: "workshop", label: "Workshop", description: "多轮研讨" },
];

let container: HTMLDivElement | null = null;

function AgentToolbar() {
  const [, forceUpdate] = useState(0);
  const activeMode = store.state.value.agentMode;
  const selectedCount = store.state.value.selectedFragmentIds.length;
  const extraction = store.state.value.extraction;
  const protagonistProfile = store.state.value.protagonistProfile;
  const worldOntology = store.state.value.worldOntology;
  const project = store.state.value.project;

  useEffect(() => {
    return store.state.subscribe(() => forceUpdate((n) => n + 1));
  }, []);

  const handleModeClick = (mode: AgentMode) => {
    store.setAgentMode(activeMode === mode ? null : mode);
  };

  const handleRun = async () => {
    const mode = store.state.value.agentMode;
    const selectedIds = store.state.value.selectedFragmentIds;
    const focusedId = store.state.value.focusedFragmentId;

    const fragmentIds = selectedIds.length > 0
      ? selectedIds
      : focusedId ? [focusedId] : [];

    if (!mode || fragmentIds.length === 0) return;

    // Get selected text from editor textarea
    const textarea = document.querySelector(".editor-content") as HTMLTextAreaElement | null;
    let segmentText: string | undefined;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      if (start !== end) {
        segmentText = textarea.value.substring(start, end);
      }
    }

    store.clearStream();

    if (mode === "workshop") {
      await api.workshopStart(fragmentIds[0], segmentText ? { segmentText } : undefined);
    } else {
      await api.agentRun({ mode, fragmentIds });
    }
  };

  const canRun = activeMode && (selectedCount > 0 || store.state.value.focusedFragmentId !== null);

  const handleExtract = (type: string) => {
    if (!project) return;
    const selectedIds = store.state.value.selectedFragmentIds.length > 0
      ? store.state.value.selectedFragmentIds : undefined;
    store.startExtraction(type, project.id, selectedIds);
  };

  const handleCancelExtraction = () => {
    store.cancelExtraction();
  };

  const isExtracting = extraction && !extraction.complete;

  return html`
    <div class="agent-modes">
      <div class="agent-modes-grid">
        ${MODES.map(
          (m) => html`
            <button
              class=${`agent-mode-btn ${activeMode === m.mode ? "agent-mode-active" : ""}`}
              onClick=${() => handleModeClick(m.mode)}
              title=${m.description}
            >
              ${m.label}
            </button>
          `
        )}
      </div>

      <div class="extraction-section">
        <div class="extraction-section-label">Context Extraction</div>
        <div class="extraction-buttons">
          <button
            class="extract-btn"
            onClick=${() => handleExtract("protagonist")}
            disabled=${isExtracting}
            title="Extract 14-dim psychology profile from all fragments"
          >
            ${protagonistProfile ? "Update Profile" : "Extract Profile"}
          </button>
          <button
            class="extract-btn"
            onClick=${() => handleExtract("worldview")}
            disabled=${isExtracting}
            title="Extract 7-dim world ontology from all fragments"
          >
            ${worldOntology ? "Update Worldview" : "Extract Worldview"}
          </button>
        </div>
        ${isExtracting && html`
          <div class="extraction-progress">
            <span>Extracting ${extraction.type}...</span>
            ${extraction.totalBatches > 1 && html`
              <span>Batch ${extraction.batch}/${extraction.totalBatches}</span>
            `}
            <button class="extract-cancel-btn" onClick=${handleCancelExtraction}>Cancel</button>
          </div>
        `}
        ${protagonistProfile && !isExtracting && html`
          <div class="extraction-status">Profile ready</div>
        `}
        ${worldOntology && !isExtracting && html`
          <div class="extraction-status">Worldview ready</div>
        `}
      </div>

      ${activeMode &&
      (() => {
        const effectiveCount = selectedCount > 0 ? selectedCount : (store.state.value.focusedFragmentId ? 1 : 0);
        const isWorkshop = activeMode === "workshop";
        return html`
        <div class="agent-run-bar">
          <span class="agent-run-info">${activeMode} — ${effectiveCount} fragment${effectiveCount !== 1 ? "s" : ""}</span>
          ${isWorkshop && !protagonistProfile && html`
            <span class="workshop-hint">Tip: Extract Profile first for better analysis</span>
          `}
          <button class="agent-run-btn" onClick=${handleRun} disabled=${!canRun}>Run</button>
        </div>
        `;
      })()}
    </div>
  `;
}

function mount() {
  const toolbar = document.getElementById("panel-right-toolbar");
  if (!toolbar) return;

  const placeholder = toolbar.querySelector(".panel-header");
  if (placeholder) placeholder.remove();

  container = document.createElement("div");
  container.className = "agent-toolbar";
  toolbar.appendChild(container);

  function renderToolbar() {
    if (!container) return;
    render(html`<${AgentToolbar} />`, container);
  }

  renderToolbar();
  return () => {
    container?.remove();
    container = null;
  };
}

export default { manifest, onLoad: plugin.onLoad };

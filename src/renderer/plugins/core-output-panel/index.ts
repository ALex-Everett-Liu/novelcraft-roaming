import { render } from "preact";
import { html } from "htm/preact";
import { useEffect, useState, useRef } from "preact/hooks";
import { store } from "../../state/store";
import { api } from "../../rpc/api";
import type { RendererPluginContext } from "../../plugin-system/RendererPluginContext";
import type { CritiqueQuestion } from "../../../shared/types";
import { manifest } from "./manifest";

const plugin = {
  manifest,
  async onLoad(_ctx: RendererPluginContext) {
    mount();
  },
};

let container: HTMLDivElement | null = null;

function WorkshopChat() {
  const streamText = store.state.value.streamText;
  const streamComplete = store.state.value.streamComplete;
  const workshopState = store.state.value.workshopState;
  const selectedIds = store.state.value.selectedFragmentIds;

  const [input, setInput] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const chatEnd = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [streamText, workshopState?.conversationHistory?.length]);

  // ─── Submit question answers ─────────────────────
  const handleSubmitAnswers = async () => {
    if (!workshopState) return;
    const answerList = workshopState.questions
      .filter((q) => answers[q.id]?.trim())
      .map((q) => ({ questionId: q.id, answer: answers[q.id].trim() }));

    if (answerList.length === 0) return;

    // Add answers to conversation history
    const history = [
      ...(workshopState.conversationHistory || []),
      { role: "user" as const, content: answerList.map((a, i) => {
        const q = workshopState.questions.find(x => x.id === a.questionId);
        return `**${q?.question || ""}**\n${a.answer}`;
      }).join("\n\n") },
    ];

    setAnswers({});
    store.setWorkshopState({ ...workshopState, stage: "discussing", conversationHistory: history });
    store.clearStream();
    await api.workshopAnswer({
      fragmentId: workshopState.chapterFragmentId,
      answers: answerList,
      questions: workshopState.questions,
      history: workshopState.conversationHistory || [],
    });
  };

  // ─── Send a chat message ─────────────────────────
  const handleSend = async () => {
    if (!workshopState || !input.trim()) return;

    const text = input.trim();
    setInput("");

    // Add user message to history
    const history = [
      ...(workshopState.conversationHistory || []),
      { role: "user" as const, content: text },
    ];

    store.setWorkshopState({ ...workshopState, stage: "discussing", conversationHistory: history });
    store.clearStream();

    await api.workshopAnswer({
      fragmentId: workshopState.chapterFragmentId,
      answers: [{ questionId: "chat", answer: text }],
      questions: [{ id: "chat", question: "" }],
      history: workshopState.conversationHistory || [],
    });
  };

  // ─── Start Revising ──────────────────────────────
  const handleRevise = async () => {
    if (!workshopState) return;
    const discussion = (workshopState.conversationHistory || [])
      .map((h) => `${h.role === "agent" ? "导师" : "作者"}：${h.content}`)
      .join("\n\n");

    store.setWorkshopState({ ...workshopState, stage: "revising" });
    store.clearStream();
    await api.workshopRevise({ fragmentId: workshopState.chapterFragmentId, discussion });
  };

  // ─── Accept / Reject ─────────────────────────────
  const handleAccept = async () => {
    const text = streamText;
    store.clearStream();
    store.setAgentMode(null);
    store.setWorkshopState(null as any);
    if (text) store.createFragment(text);
  };

  const handleReject = () => {
    store.clearStream();
    store.setAgentMode(null);
    store.setWorkshopState(null as any);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Build message list from conversation history + streaming text
  const messages: { role: string; content: string }[] = [];

  if (workshopState?.conversationHistory) {
    for (const h of workshopState.conversationHistory) {
      messages.push(h);
    }
  }

  // Show streaming text as a pending agent message
  if (streamText && !streamComplete) {
    messages.push({ role: "agent-pending", content: streamText });
  } else if (streamComplete && streamText) {
    messages.push({ role: "agent", content: streamText });
  }

  const isRevising = workshopState?.stage === "revising";
  const isReview = workshopState?.stage === "review" || (streamComplete && isRevising);
  const showQuestionForm = workshopState?.stage === "questions" && workshopState.questions.length > 0 &&
    (workshopState.conversationHistory || []).length <= 1;

  // ─── Question Form ──────────────────────────────
  if (showQuestionForm) {
    return html`
      <div class="workshop-chat">
        <div class="workshop-chat-messages">
          ${workshopState.questions.map((q: CritiqueQuestion, i: number) => html`
            <div class="workshop-question-item">
              <div class="workshop-question-section">${q.section}</div>
              <div class="workshop-question-text">${i + 1}. ${q.question}</div>
              <textarea
                class="workshop-answer-input"
                value=${answers[q.id] || ""}
                onInput=${(e: Event) => {
                  const val = (e.target as HTMLTextAreaElement).value;
                  setAnswers({ ...answers, [q.id]: val });
                }}
                placeholder="Your response..."
                spellcheck=${false}
              />
            </div>
          `)}
        </div>
        <div class="workshop-chat-actions">
          <button class="output-btn output-btn-accept" onClick=${handleSubmitAnswers}>Submit & Discuss</button>
        </div>
      </div>
    `;
  }

  // ─── Chat Layout ────────────────────────────────
  return html`
    <div class="workshop-chat">
      <div class="workshop-chat-messages">
        ${messages.length === 0 && !streamText
          ? html`<div class="workshop-chat-empty">Waiting for workshop to begin...</div>`
          : messages.map((m) => html`
            <div class=${`workshop-msg ${m.role === "user" ? "workshop-msg-user" : "workshop-msg-agent"}`}>
              <div class="workshop-msg-role">${m.role === "user" ? "You" : "Workshop"}</div>
              <div class="workshop-msg-content">${m.content}</div>
            </div>
          `)}
        <div ref=${chatEnd} />
      </div>

      ${isReview
        ? html`
          <div class="workshop-chat-actions">
            <button class="output-btn output-btn-accept" onClick=${handleAccept}>Accept</button>
            <button class="output-btn output-btn-reject" onClick=${handleReject}>Reject</button>
          </div>
        `
        : html`
          <div class="workshop-chat-input">
            <textarea
              class="workshop-chat-textarea"
              value=${input}
              onInput=${(e: Event) => setInput((e.target as HTMLTextAreaElement).value)}
              onKeyDown=${handleKeyDown}
              placeholder="Type your response... (Enter to send, Shift+Enter for new line)"
              rows="2"
              disabled=${!!(streamText && !streamComplete)}
              spellcheck=${false}
            />
            <div class="workshop-chat-input-row">
              <button class="output-btn" onClick=${handleSend} disabled=${!input.trim()}>Send</button>
              ${workshopState?.conversationHistory?.length > 0 && !isRevising && html`
                <button class="output-btn output-btn-accept" style="margin-left:auto" onClick=${handleRevise}>Start Revising</button>
              `}
            </div>
          </div>
        `}
    </div>
  `;
}

// ===== Extraction Progress View =====
function ExtractionView() {
  const extraction = store.state.value.extraction;
  if (!extraction) return html`<div>No extraction data</div>`;

  if (extraction.error) {
    return html`
      <div class="output-container">
        <div class="extraction-error">${extraction.error}</div>
      </div>
    `;
  }

  if (!extraction.complete) {
    return html`
      <div class="output-container">
        <div class="extraction-progress-view">
          Extracting ${extraction.type}...
          ${extraction.totalBatches > 1 ? ` (Batch ${extraction.batch}/${extraction.totalBatches})` : ""}
        </div>
        <div class="output-content">${extraction.streamText}</div>
      </div>
    `;
  }

  return html`
    <div class="output-container">
      <div class="extraction-done">${extraction.statusMessage}</div>
    </div>
  `;
}

// ===== Profile Viewer (Foldable JSON) =====
const DIMENSION_LABELS: Record<string, string> = {
  basicAnchors: "基础锚点",
  personalitySystem: "人格操作系统",
  motivationSystem: "动力与动机系统",
  emotionDefense: "情感与防御机制",
  behaviorFingerprint: "行为指纹与身体语言",
  relationshipCoordinate: "关系坐标系",
  growthArc: "变化轨迹与弧光",
  oocRedlines: "OOC红线与强制约束",
  epistemicState: "认知不对等模型",
  narrativeVoice: "内在叙事声音",
  worldInteraction: "主角-世界交互层",
  culturalScripts: "文化-意识形态层",
  selfContradictions: "矛盾与多重自我",
  embodiedExperience: "身体现象学",
  existentialTopology: "存在拓扑",
  causalArchitecture: "因果架构",
  spatioTemporalOntology: "时空本体论",
  informationEpistemology: "信息与认识论",
  axiologicalFoundation: "价值论基础",
  becomingDynamics: "生成动力学",
  narrativeOntology: "叙事本体论",
};

function FoldableSection({ label, data }: { label: string; data: any }) {
  const [open, setOpen] = useState(false);

  if (!data || typeof data !== "object" || (Object.keys(data).length === 0)) {
    return html`
      <div class="profile-dim profile-dim-empty">
        <span>${label}</span>
        <span class="profile-dim-empty-tag">(empty)</span>
      </div>
    `;
  }

  const keys = Object.keys(data);

  return html`
    <div class="profile-dim">
      <button class="profile-dim-toggle" onClick=${() => setOpen(!open)}>
        <span class="profile-dim-arrow">${open ? "v" : ">"}</span>
        <span class="profile-dim-label">${label}</span>
        <span class="profile-dim-count">${keys.length} fields</span>
      </button>
      ${open && html`
        <div class="profile-dim-body">
          ${keys.map((k) => html`
            <div class="profile-field">
              <span class="profile-field-key">${k}</span>
              <span class="profile-field-value">
                ${typeof data[k] === "object"
                  ? JSON.stringify(data[k], null, 2)
                  : String(data[k])}
              </span>
            </div>
          `)}
        </div>
      `}
    </div>
  `;
}

function ProfileViewer() {
  const [tab, setTab] = useState<"protagonist" | "ontology">("protagonist");
  const protagonistProfile = store.state.value.protagonistProfile;
  const worldOntology = store.state.value.worldOntology;

  const currentData = tab === "protagonist" ? protagonistProfile : worldOntology;
  const metaKeys = ["extractedAt", "sourceChapterRange"];

  const dimensions = currentData
    ? Object.keys(currentData).filter((k) => !metaKeys.includes(k))
    : [];

  return html`
    <div class="profile-viewer">
      <div class="profile-tabs">
        <button
          class=${`profile-tab ${tab === "protagonist" ? "profile-tab-active" : ""}`}
          onClick=${() => setTab("protagonist")}
          disabled=${!protagonistProfile}
        >
          Protagonist ${protagonistProfile ? "" : "(none)"}
        </button>
        <button
          class=${`profile-tab ${tab === "ontology" ? "profile-tab-active" : ""}`}
          onClick=${() => setTab("ontology")}
          disabled=${!worldOntology}
        >
          Worldview ${worldOntology ? "" : "(none)"}
        </button>
      </div>
      <div class="profile-content">
        ${currentData && dimensions.length > 0
          ? dimensions.map((dim) => html`
              <${FoldableSection}
                label=${`${DIMENSION_LABELS[dim] || dim} (${dim})`}
                data=${currentData[dim]}
              />
            `)
          : html`<div class="profile-empty">No data extracted yet. Click "Extract Profile" or "Extract Worldview" in the toolbar.</div>`
        }
      </div>
    </div>
  `;
}

function OutputPanel() {
  const [, forceUpdate] = useState(0);
  const streamText = store.state.value.streamText;
  const streamComplete = store.state.value.streamComplete;
  const agentMode = store.state.value.agentMode;
  const selectedIds = store.state.value.selectedFragmentIds;
  const extraction = store.state.value.extraction;
  const protagonistProfile = store.state.value.protagonistProfile;
  const worldOntology = store.state.value.worldOntology;

  useEffect(() => {
    return store.state.subscribe(() => forceUpdate((n) => n + 1));
  }, []);

  // ─── Accept / Reject (non-workshop) ─────────────
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

  // ─── Workshop: Copilot Chat ──────────────────────
  if (agentMode === "workshop") {
    return html`<${WorkshopChat} />`;
  }

  // ─── Extraction active ─────────────────────────────
  if (extraction) {
    if (!extraction.complete) {
      return html`<${ExtractionView} />`;
    }
    // Extraction complete — show profiles if available, else done message
    if (protagonistProfile || worldOntology) {
      return html`<${ProfileViewer} />`;
    }
    return html`<${ExtractionView} />`;
  }

  // ─── Profiles available (show foldable viewer) ─────
  if (protagonistProfile || worldOntology) {
    return html`<${ProfileViewer} />`;
  }

  // ─── Non-workshop modes ──────────────────────────
  if (streamText && !streamComplete) {
    return html`
      <div class="output-container">
        <div class="output-content">${streamText}</div>
      </div>
    `;
  }

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
    return html`<div class="output-placeholder">Select a mode in the toolbar and click Run</div>`;
  }

  return html`<div class="output-placeholder">Click "Run" to start ${agentMode} mode</div>`;
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

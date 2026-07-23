import { render } from "preact";
import { html } from "htm/preact";
import { useState, useEffect } from "preact/hooks";
import { store } from "../../state/store";
import { api } from "../../rpc/api";
import { getAllThemes, applyTheme, getCurrentTheme } from "../../theme/themeManager";
import type { RendererPluginContext } from "../../plugin-system/RendererPluginContext";
import { manifest } from "./manifest";

const plugin = {
  manifest,
  async onLoad(_ctx: RendererPluginContext) {
    window.addEventListener("novelcraft:open-settings", () => showModal());
    return () => window.removeEventListener("novelcraft:open-settings", () => showModal());
  },
};

let modalContainer: HTMLDivElement | null = null;

function showModal() {
  if (modalContainer) {
    modalContainer.remove();
    modalContainer = null;
  }

  modalContainer = document.createElement("div");
  modalContainer.className = "settings-overlay";
  document.body.appendChild(modalContainer);

  function renderSettings() {
    if (!modalContainer) return;
    render(html`<${SettingsModal} onClose=${closeModal} />`, modalContainer);
  }

  renderSettings();
  const unsubscribe = store.state.subscribe(() => renderSettings());
  return () => {
    unsubscribe();
  };
}

function closeModal() {
  modalContainer?.remove();
  modalContainer = null;
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState("0.8");
  const [maxTokens, setMaxTokens] = useState("4096");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const config = store.state.value.llmConfig;
    if (config) {
      setBaseUrl(config.baseUrl || "https://api.openai.com");
      setApiKey(config.apiKey || "");
      setModel(config.model || "gpt-4o");
      setTemperature(String(config.temperature ?? 0.8));
      setMaxTokens(String(config.maxTokens ?? 4096));
    }
  }, []);

  const handleSave = async () => {
    setError("");
    if (!apiKey.trim()) {
      setError("API Key is required");
      return;
    }
    const config = {
      baseUrl: baseUrl.trim() || "https://api.openai.com",
      apiKey: apiKey.trim(),
      model: model.trim() || "gpt-4o",
      temperature: parseFloat(temperature) || 0.8,
      maxTokens: parseInt(maxTokens) || 4096,
    };
    await store.saveLLMConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const currentTheme = getCurrentTheme();
  const allThemes = getAllThemes();

  return html`
    <div class="settings-modal" onClick=${(e: Event) => e.stopPropagation()}>
      <div class="settings-header">
        <h2>Settings</h2>
        <button class="settings-close" onClick=${onClose}>x</button>
      </div>
      <div class="settings-body">
        <section class="settings-section">
          <h3>LLM Configuration</h3>
          <label class="settings-label">Base URL</label>
          <input class="settings-input" type="text" value=${baseUrl} onInput=${(e: Event) => setBaseUrl((e.target as HTMLInputElement).value)} placeholder="https://api.openai.com" />
          <label class="settings-label">API Key</label>
          <input class="settings-input" type="password" value=${apiKey} onInput=${(e: Event) => setApiKey((e.target as HTMLInputElement).value)} placeholder="sk-..." />
          <label class="settings-label">Model</label>
          <input class="settings-input" type="text" value=${model} onInput=${(e: Event) => setModel((e.target as HTMLInputElement).value)} placeholder="gpt-4o" />
          <div class="settings-row">
            <div>
              <label class="settings-label">Temperature</label>
              <input class="settings-input settings-input-small" type="number" value=${temperature} min="0" max="2" step="0.1" onInput=${(e: Event) => setTemperature((e.target as HTMLInputElement).value)} />
            </div>
            <div>
              <label class="settings-label">Max Tokens</label>
              <input class="settings-input settings-input-small" type="number" value=${maxTokens} onInput=${(e: Event) => setMaxTokens((e.target as HTMLInputElement).value)} />
            </div>
          </div>
          ${error && html`<div class="settings-error">${error}</div>`}
          <button class="settings-btn" onClick=${handleSave}>
            ${saved ? "Saved!" : "Save"}
          </button>
        </section>

        <section class="settings-section">
          <h3>Theme</h3>
          <div class="theme-grid">
            ${Object.entries(allThemes).map(([id, theme]) => html`
              <button
                class=${`theme-card ${id === currentTheme ? "theme-card-active" : ""}`}
                onClick=${() => applyTheme(id)}
              >
                <div class="theme-card-name">${theme.name}</div>
                <div class="theme-card-desc">${theme.description}</div>
              </button>
            `)}
          </div>
        </section>
      </div>
    </div>
  `;
}

export default { manifest, onLoad: plugin.onLoad };

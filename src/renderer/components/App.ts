import { html } from "htm/preact";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { store } from "../state/store";
import { Toolbar } from "./Toolbar";
import { api } from "../rpc/api";
import { getAllThemes, applyTheme, getCurrentTheme } from "../theme/themeManager";

function SettingsModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"llm" | "theme" | "plugins">("llm");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState("0.8");
  const [maxTokens, setMaxTokens] = useState("4096");
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = useState("");
  const [plugins, setPlugins] = useState<any[]>([]);

  useEffect(() => {
    api.listPlugins().then((res) => {
      if (res.success && res.data) setPlugins(res.data);
    });
  }, [tab]);

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

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const url = `${baseUrl.trim().replace(/\/+$/, "")}/chat/completions`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: model.trim(),
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 1,
          stream: false,
        }),
      });
      if (res.ok) {
        setTestResult({ ok: true, message: "Connection successful!" });
      } else if (res.status === 401 || res.status === 403) {
        setTestResult({ ok: false, message: "Invalid API key" });
      } else {
        const text = await res.text().catch(() => "");
        setTestResult({ ok: false, message: `HTTP ${res.status}: ${text.slice(0, 100) || res.statusText}` });
      }
    } catch (e: any) {
      setTestResult({ ok: false, message: `Connection failed: ${e.message || String(e)}` });
    }
    setTesting(false);
  };

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
        <div class="settings-tabs">
          <button class=${`settings-tab ${tab === "llm" ? "settings-tab-active" : ""}`} onClick=${() => setTab("llm")}>LLM</button>
          <button class=${`settings-tab ${tab === "theme" ? "settings-tab-active" : ""}`} onClick=${() => setTab("theme")}>Theme</button>
          <button class=${`settings-tab ${tab === "plugins" ? "settings-tab-active" : ""}`} onClick=${() => setTab("plugins")}>Plugins</button>
        </div>

        ${tab === "llm" &&
        html`
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
          <div class="settings-actions">
            <button class="settings-btn" onClick=${handleSave}>
              ${saved ? "Saved!" : "Save"}
            </button>
            <button class="settings-btn settings-btn-test" onClick=${handleTestConnection} disabled=${testing}>
              ${testing ? "Testing..." : "Test Connection"}
            </button>
          </div>
          ${testResult &&
          html`
            <div class=${`settings-test-result ${testResult.ok ? "settings-test-ok" : "settings-test-fail"}`}>
              ${testResult.message}
            </div>
          `}
        </section>
        `}

        ${tab === "theme" &&
        html`
        <section class="settings-section">
          <h3>Theme</h3>
          <div class="theme-grid">
            ${Object.entries(allThemes).map(([id, theme]) => html`
              <button class=${`theme-card ${id === currentTheme ? "theme-card-active" : ""}`} onClick=${() => applyTheme(id)}>
                <div class="theme-card-name">${theme.name}</div>
                <div class="theme-card-desc">${theme.description}</div>
              </button>
            `)}
          </div>
        </section>
        `}

        ${tab === "plugins" &&
        html`
        <section class="settings-section">
          <h3>Plugins</h3>
          <div class="plugin-list">
            ${plugins.length === 0
              ? html`<div class="settings-test-result settings-test-fail">No plugins loaded — is the main process running?</div>`
              : plugins.map((p) => html`
                <div class="plugin-item">
                  <div class="plugin-item-info">
                    <div class="plugin-item-name">
                      ${p.name}
                      ${p.essential ? html`<span class="plugin-badge">essential</span>` : ""}
                    </div>
                    <div class="plugin-item-desc">${p.description}</div>
                  </div>
                  <div class="plugin-item-actions">
                    ${p.enabled
                      ? html`<span class="plugin-status plugin-status-on">ON</span>`
                      : html`<span class="plugin-status plugin-status-off">OFF</span>`}
                  </div>
                </div>
              `)}
          </div>
        </section>
        `}
      </div>
    </div>
  `;
}

export function App() {
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    return store.state.subscribe(() => {
      setLoading(store.state.value.loading);
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (store.hasUnsavedChanges()) store.saveAll();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        setShowSettings((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (loading) {
    return html`<div class="loading">Loading...</div>`;
  }

  return html`
    <div class="app">
      <${Toolbar} onOpenSettings=${() => setShowSettings(true)} />
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
      ${showSettings &&
      html`
        <div class="settings-overlay" onClick=${() => setShowSettings(false)}>
          <${SettingsModal} onClose=${() => setShowSettings(false)} />
        </div>
      `}
    </div>
  `;
}

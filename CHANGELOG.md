# Changelog

All notable changes to the NovelCraft Roaming project.

## [Unreleased]

### Added

- **Project skeleton**: Electrobun + Bun + Preact + htm + SQLite project at `novelcraft-roaming/`
- **Plugin system**: full plugin infrastructure (PluginManager, EventBus, DependencyResolver, RpcHandlerRegistry) replicated from mindscape-roaming — 4 main plugins + 4 renderer plugins loaded
- **core-data-layer** plugin: Fragment/Chapter/Project CRUD with SQLite storage, TEXT export/import, indexed queries
- **core-settings** plugin: LLM config persistence (JSON file at data dir)
- **core-llm-client** plugin: OpenAI-compatible SSE streaming HTTP client with abort support
- **core-agent-engine** plugin: 8 agent modes (Polish, Bridge, Splice, Expand, Diverge, Continue, Complete, Workshop) with embedded prompt templates
- **core-fragment-panel** renderer plugin: fragment list with type badges, selection, add/delete
- **core-fragment-editor** renderer plugin: title + content editing with 2s debounced auto-save
- **core-agent-toolbar** renderer plugin: 8 mode buttons in 4x2 grid with mode highlighting and Run button
- **core-output-panel** renderer plugin: streaming output display with Accept/Reject buttons; Diverge mode JSON parsing + batch fragment creation; streamComplete state tracking
- **core-settings-ui** renderer plugin: Settings dialog (LLM config + theme picker) with Ctrl+, shortcut
- **Main→Renderer message bridge**: plugin sendMessage API via BrowserView RPC transport for SSE streaming chunks

### Fixed

- **Renderer plugins loaded before DOM ready**: moved plugin loading after `store.initialLoad()` in the 300ms deferred `setTimeout`, following the proven mindscape-roaming pattern instead of attempting Preact hooks lifecycle
- **Missing Electroview RPC bridge in renderer**: `Electroview.defineRPC()` + `initApi()` added to `renderer/index.ts` (was entirely absent, causing "API not initialized" errors)
- **Removed redundant setInterval polling**: 3 renderer plugins (fragment-panel, fragment-editor, agent-toolbar) had `setInterval(500ms)` re-renders despite already subscribing to `store.state.subscribe()`
- **Settings modal**: added tabbed UI (LLM / Theme / Plugins) with plugin enable/disable status display

### Changed

- **Settings UI**: reorganized into tabs (LLM / Theme / Plugins) with a dedicated Plugins panel showing all registered plugin names, descriptions, essential badge, and ON/OFF status
- **Toolbar**: Signals-based subscription (no polling), Settings button, Ctrl+S save shortcut
- **Four-column layout**: Fragments (240px) | Editor (flex) | Agent Toolbar + Output (360px)
- **Save/Discard mechanism**: backup-based with `ensureBackup()`/`commitSave()`/`restoreFromBackup()`
- **Theme system**: dark/light themes with CSS custom properties (via `themeManager.ts`)
- **Debounce utility**: 500ms standard debounce in `src/renderer/utils/debounce.ts`
- **Shared type system**: Zod schemas for Fragment, Chapter, Project, LLMConfig, AgentMode, WorkshopState
- **RPC schema**: typed Electrobun RPC contract for bun↔webview communication

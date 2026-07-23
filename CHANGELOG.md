# Changelog

All notable changes to the NovelCraft Roaming project.

## [Unreleased]

### Added

- **Extraction diff viewer**: after each extraction completes, a field-level diff is shown (added/changed/removed, with before/after values), so users can verify the LLM actually performed incremental updates. Diff data is computed on the main process and sent via `extractionDone` message. A "View Full Profile" button navigates to the foldable profile viewer.
- **Version snapshots**: each extraction now saves a timestamped JSON snapshot to `<dataDir>/extraction-history/` with an index file for easy external comparison.
- **Inline profile editing**: `ProfileViewer` now supports click-to-edit on any field. String fields open as textareas; object fields open as JSON textareas. Ctrl+Enter to save, Esc to cancel. An edit bar with "Save Changes" / "Revert" appears when edits are pending. Changes are persisted to the database via new `protagonistProfileSave` and `worldOntologySave` RPC handlers.

### Fixed

- **Extraction button scope undiscoverable**: the "Extract Profile" / "Update Profile" label and tooltip always said "from all fragments" even when fragments were pre-selected. Now shows count and scope inline: "Update Profile (3)" with tooltip "from 3 selected fragments". Fragment pre-selection (click in tree sidebar before clicking the button) already scoped extraction — this just makes it visible.
- **Incremental extraction not injecting existing profile**: `doExtraction()` read `existingProfile` from the database but never injected it into the LLM prompt. Added `{{existingProfile}}` / `{{existingOntology}}` placeholders to prompts and wired the replacement. Subsequent extractions now see the prior profile and incrementally update it rather than overwriting from scratch.

### Changed

## [0.1.2] - 2026-07-23

### Added

- **Extraction diff viewer**: after each extraction completes, a field-level diff is shown (added/changed/removed, with before/after values), so users can verify the LLM actually performed incremental updates. Diff data is computed on the main process and sent via `extractionDone` message. A "View Full Profile" button navigates to the foldable profile viewer.
- **Version snapshots**: each extraction now saves a timestamped JSON snapshot to `<dataDir>/extraction-history/` with an index file for easy external comparison.

- **Docs**: `docs/extraction-lessons-learned.md` — 9 lessons from extraction feature implementation (PluginManager operator precedence, buildRpcHandlers hardcoding, chicken-and-egg migration, void RPC logging crash, completion→viewer transition, save/discard integration, fire-and-forget pattern, multi-column update isolation, JSON column parsing)

- **14-dimension protagonist psychology archive**: `ProtagonistProfile` with 8 original GengBi dimensions (basicAnchors, personalitySystem, motivationSystem, emotionDefense, behaviorFingerprint, relationshipCoordinate, growthArc, oocRedlines) plus 6 new dimensions:
  - **epistemicState**: knowledge asymmetry model (known facts, false beliefs, secrets, blind spots, epistemic authority)
  - **narrativeVoice**: internal thought style, self-address, rumination pattern, unreliable narration tendency, metaphor system
  - **worldInteraction**: protagonist-world bridge layer — rule awareness, rule attitude, unique abilities in world, social position, arc constraints
  - **culturalScripts**: Bourdieu class habitus, gender scripts, Haidt moral foundations, honor vs dignity culture, filial piety complex, tribal identity
  - **selfContradictions**: core paradox, situational self-switching, value conflicts, aspirational vs actual self, self-deception mechanisms
  - **embodiedExperience**: dominant sensory channel, body awareness, Damasio somatic markers, pain response, physical presence, fatigue patterns
  - Theoretical basis: Erikson, Freud, OCEAN, Bowlby/Ainsworth attachment, Maslow, Schwartz values, Adler lifestyle, Anna Freud defenses, Ekman non-verbal communication, Damasio somatic markers, Bourdieu habitus, Haidt moral foundations, Campbell hero's journey

- **7-dimension world ontology extraction**: `WorldOntology` (existentialTopology, causalArchitecture, spatioTemporalOntology, informationEpistemology, axiologicalFoundation, becomingDynamics, narrativeOntology) with multi-batch token-split extraction and LLM semantic merge

- **`core-context-extractor`** main plugin: batched LLM extraction service with js-tiktoken `o200k_base` token counting, batch splitting on fragment boundaries, incremental batch extraction with prior-profile injection, field-level merge rules (overwrite vs length heuristic), multi-batch LLM semantic merge, fire-and-forget RPC handlers

- **Bridge extraction**: automatically triggered after both protagonist and world ontology profiles exist — LLM analyzes interaction between character psychology and world rules, returns `worldInteraction` fixes, `profileAmendments`, and `arcConstraints`

- **Dynamic incremental updates**: subsequent extractions inject the previous profile as "current knowledge" — LLM deepens/corrects/supplements rather than starting from scratch

- **Profile injection into all agent modes**: every prompt (Polish, Bridge, Splice, Expand, Diverge, Continue, Complete, Workshop Analyze, Workshop Revise) now includes `{{protagonist_profile}}` and `{{world_ontology}}` placeholders, auto-injected from DB during `agentRun` and `workshopStart`

- **Extraction RPCs**: `protagonistExtract`, `worldOntologyExtract`, `bridgeExtract`, `extractionCancel`, `protagonistGet`, `worldOntologyGet`, `novelProfileSave` with streaming progress messages (`extractionChunk`, `extractionDone`, `extractionError`, `extractionProgress`)

- **Extraction UI**: "Extract Profile" and "Extract Worldview" buttons in toolbar with progress indicator, cancel button, and status display; workshop mode shows tip when no profile exists

- **Foldable profile viewer**: 14-dim / 7-dim JSON viewer in output panel with dimension-level collapse/expand, tabbed protagonist/worldview switching, field-level key-value display

- **NovelProfile settings tab**: LLM-extracted + user-editable metadata (title, author, protagonist, synopsis, world setting, writing style) with save button; auto-filled from protagonist extraction `basicAnchors`

- **DB migrations**: `ALTER TABLE projects ADD COLUMN novel_profile`, `protagonist_profile`, `world_ontology` (TEXT, JSON-encoded)

### Fixed

- **Extraction button scope undiscoverable**: the "Extract Profile" / "Update Profile" label and tooltip always said "from all fragments" even when fragments were pre-selected. Now shows count and scope inline: "Update Profile (3)" with tooltip "from 3 selected fragments". Fragment pre-selection (click in tree sidebar before clicking the button) already scoped extraction — this just makes it visible.
- **Incremental extraction not injecting existing profile**: `doExtraction()` read `existingProfile` from the database but never injected it into the LLM prompt. Added `{{existingProfile}}` / `{{existingOntology}}` placeholders to prompts and wired the replacement. Subsequent extractions now see the prior profile and incrementally update it rather than overwriting from scratch.

- **PluginManager operator precedence**: `manifest.essential ?? manifest.enabledByDefault !== false ? 1 : 0` evaluated as `(false ?? true) ? 1 : 0` = `0`, disabling non-essential plugins on first registration. Fixed to use `||` instead of `??`.
- **`buildRpcHandlers()` missing new RPC entries**: `protagonistExtract`, `worldOntologyExtract`, `bridgeExtract`, `extractionCancel`, `protagonistGet`, `worldOntologyGet`, `novelProfileSave` handlers were registered in the registry but never wired in the hardcoded handler mapping
- **`reportUnsavedState` crash**: `JSON.stringify(undefined)` returned `undefined` (not a string), `.slice()` threw on void RPC responses; fixed with null guard
- **Extraction completion blocking ProfileViewer**: `ExtractionView` was rendered before `ProfileViewer` even when extraction was complete with data; reordered conditional chain

### Changed

- **Project mapping**: `projectsList` / `projectGet` / `projectCreate` now return `novelProfile`, `protagonistProfile`, `worldOntology` fields (deserialized from JSON)
- **Workshop analyze**: now includes protagonist profile and world ontology in system context for more informed critique questions
- **Settings dialog**: added "Novel" tab with 6 metadata fields (title, author, protagonist, synopsis, world setting, writing style)

## [0.1.1] - 2026-07-23

### Added

- **Extraction diff viewer**: after each extraction completes, a field-level diff is shown (added/changed/removed, with before/after values), so users can verify the LLM actually performed incremental updates. Diff data is computed on the main process and sent via `extractionDone` message. A "View Full Profile" button navigates to the foldable profile viewer.
- **Version snapshots**: each extraction now saves a timestamped JSON snapshot to `<dataDir>/extraction-history/` with an index file for easy external comparison.

- **Workshop mode (multi-turn)**: copilot-style chat with phases — LLM generates critique questions → user answers → discussion → revise → accept/reject
  - `workshopStart` RPC: sends selected editor text to LLM, returns 3–5 probing questions with quoted sections
  - `workshopAnswer` RPC: takes user answers + conversation history, streams discussion analysis
  - `workshopRevise` RPC: takes full discussion record, streams revised chapter text
  - `workshopDiscuss` and `workshopRevise` prompt templates in `prompts.ts`
  - Hybrid UI: question form (first round) → chat (subsequent rounds) → Accept/Reject (revised text)
  - Selected text from editor textarea passed as `segmentText` to workshop

- **Project switcher**: dropdown in toolbar shows all projects from DB, click to switch (no localStorage dependency)

- **`projectsList` RPC**: lists all projects ordered by `created_at`, used by `initialLoad` instead of localStorage

- **LLM Logs download**: inline logging of every LLM call (mode, system prompt, user prompt, full response); downloadable as `.txt` via toolbar button

- **CJK-aware word count**: `countWords()` in data layer counts each Hanzi/kana/hangul character as one word, remaining text split by whitespace

- **Dev data directory**: `getDataDir()` walks up for `electrobun.config.ts` to find project root, uses `<root>/data/` in dev mode

### Fixed

- **Extraction button scope undiscoverable**: the "Extract Profile" / "Update Profile" label and tooltip always said "from all fragments" even when fragments were pre-selected. Now shows count and scope inline: "Update Profile (3)" with tooltip "from 3 selected fragments". Fragment pre-selection (click in tree sidebar before clicking the button) already scoped extraction — this just makes it visible.
- **Incremental extraction not injecting existing profile**: `doExtraction()` read `existingProfile` from the database but never injected it into the LLM prompt. Added `{{existingProfile}}` / `{{existingOntology}}` placeholders to prompts and wired the replacement. Subsequent extractions now see the prior profile and incrementally update it rather than overwriting from scratch.

- **Main→Renderer messages never delivered**: `sendMessage` was registered after `pluginManager.loadAll()`, causing plugins to capture a no-op function. Fixed by setting `sendMessage` before `loadAll` via mutable `rpcSend` reference, plus defining message handler stubs in `BrowserView.defineRPC`.

- **`clearStream()` destroying workshopState**: `store.clearStream()` set `workshopState: null`, nuking LLM questions the moment they arrived. Removed the side effect.

- **`@preact/signals` not tracking root-rendered components**: four renderer plugins use `render(Component, container)` which creates independent Preact roots where signal auto-tracking doesn't work. Added `useState` + `store.state.subscribe()` `forceUpdate` pattern to all four.

- **Workshop LLM calls blocking RPC (timeout)**: `workshopStart`, `workshopAnswer`, `workshopRevise` handlers `await`-ed `streamLLM()`, causing 10s RPC timeout. Changed to fire-and-forget; RPC timeout increased to 60s.

- **Duplicate project created on every launch**: `initialLoad` relied on localStorage which was empty after copying build; created a new "Untitled Project" each time. Now uses `projectsList` from DB directly.

- **Editor textarea not filling panel height**: missing `display: flex` and height chain from `.panel-center` → `.fragment-editor` → `.editor-container` → `textarea`.

- **Settings "Test Connection" succeeding but agentRun failing**: `core-agent-engine` read config from `path.resolve("data")` while `core-settings` wrote via `getDataDir()` — two different paths.

### Changed

- **Defaults**: base URL → `https://api.deepseek.com`, model → `deepseek-chat`, maxTokens → `8192` (user-configurable in Settings)
- **Config-driven maxTokens**: all hardcoded `maxTokens` values replaced with `config.maxTokens` from user settings
- **Workshop analysis temperature**: hardcoded to `0.3` (focused critique), discussion uses `0.7` (balanced), other modes use user setting
- **Settings UI**: tabbed layout (LLM / Theme / Plugins) with plugin enable/disable status
- **Toolbar**: Signals-based subscription with `forceUpdate`; project name displayed next to title

## [0.1.0] - 2026-07-23 (Initial)

### Added

- **Extraction diff viewer**: after each extraction completes, a field-level diff is shown (added/changed/removed, with before/after values), so users can verify the LLM actually performed incremental updates. Diff data is computed on the main process and sent via `extractionDone` message. A "View Full Profile" button navigates to the foldable profile viewer.
- **Version snapshots**: each extraction now saves a timestamped JSON snapshot to `<dataDir>/extraction-history/` with an index file for easy external comparison.

- **Project skeleton**: Electrobun + Bun + Preact + htm + SQLite project
- **Plugin system**: full plugin infrastructure (PluginManager, EventBus, DependencyResolver, RpcHandlerRegistry) — 4 main plugins + 4 renderer plugins
- **core-data-layer** plugin: Fragment/Chapter/Project CRUD with SQLite storage, 5 migrations, TEXT import
- **core-settings** plugin: LLM config persistence as JSON file
- **core-llm-client** plugin: OpenAI-compatible SSE streaming HTTP client with abort support
- **core-agent-engine** plugin: 8 agent modes (Polish, Bridge, Splice, Expand, Diverge, Continue, Complete, Workshop) with embedded prompt templates
- **core-fragment-panel** renderer plugin: fragment list with type badges, selection, add/delete
- **core-fragment-editor** renderer plugin: title + content editing with 2s debounced auto-save
- **core-agent-toolbar** renderer plugin: 8 mode buttons in 4x2 grid with mode highlighting and Run button
- **core-output-panel** renderer plugin: streaming output display with Accept/Reject; Diverge JSON parsing + batch fragment creation
- **Electroview RPC bridge**: `Electroview.defineRPC()` + `initApi()` in `renderer/index.ts`
- **Main→Renderer message bridge**: plugin `sendMessage` API via `BrowserView.defineRPC` transport for SSE streaming chunks
- **Save/Discard mechanism**: backup-based with `ensureBackup()`/`commitSave()`/`restoreFromBackup()`
- **Theme system**: dark/light themes with CSS custom properties (`themeManager.ts`)
- **Debounce utility**: 500ms standard debounce in `src/renderer/utils/debounce.ts`
- **Shared type system**: Zod schemas for Fragment, Chapter, Project, LLMConfig, AgentMode, WorkshopState
- **RPC schema**: typed Electrobun RPC contract for bun↔webview communication
- **Settings dialog**: LLM config + theme picker with Ctrl+, shortcut and Test Connection button

### Changed

- **Layout**: four-column (Fragments 240px | Editor flex | Agent Toolbar + Output 360px)
- **Plugin loading**: deferred 300ms via `setTimeout` (matching mindscape-roaming pattern) to allow WebSocket connection

### Fixed

- **Extraction button scope undiscoverable**: the "Extract Profile" / "Update Profile" label and tooltip always said "from all fragments" even when fragments were pre-selected. Now shows count and scope inline: "Update Profile (3)" with tooltip "from 3 selected fragments". Fragment pre-selection (click in tree sidebar before clicking the button) already scoped extraction — this just makes it visible.
- **Incremental extraction not injecting existing profile**: `doExtraction()` read `existingProfile` from the database but never injected it into the LLM prompt. Added `{{existingProfile}}` / `{{existingOntology}}` placeholders to prompts and wired the replacement. Subsequent extractions now see the prior profile and incrementally update it rather than overwriting from scratch.

- **Missing Electroview RPC bridge**: added `Electroview.defineRPC()` + `initApi()` (was entirely absent, causing "API not initialized")
- **Renderer plugins loaded before DOM ready**: moved to `setTimeout` after `initialLoad`
- **Redundant `setInterval` polling**: removed from 3 renderer plugins (already had `store.state.subscribe()`)
- **Editor textarea height**: `.fragment-editor` and `.editor-container` now use flex column + height chain
- **Dev data directory path**: `getDataDir()` walks cwd for `electrobun.config.ts`, falls back to `userData`
- **Agent engine config path mismatch**: unified to use `getDataDir()` instead of `path.resolve("data")`

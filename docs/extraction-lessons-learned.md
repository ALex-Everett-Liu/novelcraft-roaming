# Extraction Feature — Lessons Learned

This document records bugs, architectural pitfalls, and design decisions discovered during the implementation of the 14-dim protagonist profile, 7-dim world ontology, and bridge extraction features in `core-context-extractor`.

---

## 1. PluginManager Operator Precedence Bug

**Symptom**: Non-essential plugins with `enabledByDefault: true` and `essential: false` are inserted into `_plugin_state` as `enabled = 0` on first registration.

**Root cause**: In `PluginManager.register()`:

```typescript
// BUGGY — ?? binds tighter than ?:
const enabled = manifest.essential ?? manifest.enabledByDefault !== false ? 1 : 0;

// Evaluated as:
// (manifest.essential ?? (manifest.enabledByDefault !== false)) ? 1 : 0
// For essential=false, enabledByDefault=true:
//   (false ?? true) ? 1 : 0
//   = false ? 1 : 0
//   = 0  ← DISABLED
```

**Fix**: Use `||` instead of `??` so `false` is treated as falsy and falls through to `enabledByDefault`:

```typescript
const enabled = (manifest.essential || manifest.enabledByDefault !== false) ? 1 : 0;
```

**Lesson**: `??` is not a drop-in replacement for `||`. When the left side can be an explicit `false`, use `||` or check explicitly: `manifest.essential === true`.

---

## 2. `buildRpcHandlers()` — Hardcoded Handler Mapping

**Symptom**: New RPC handlers return `{ success: false, error: "Handler X not registered" }` despite `ctx.registerRpcHandler()` being called correctly.

**Root cause**: `PluginManager.buildRpcHandlers()` does NOT dynamically enumerate the `RpcHandlerRegistry`. Instead, it has a manually maintained whitelist that maps each handler name to a `wrap()` call. Every new RPC must be explicitly listed here.

**Affected methods**:
- `protagonistExtract`, `worldOntologyExtract`, `bridgeExtract`
- `extractionCancel`
- `protagonistGet`, `worldOntologyGet`
- `novelProfileSave`

**Fix**: Added all 7 new handler names to `buildRpcHandlers()` in `PluginManager.ts`.

**Lesson**: When adding a new RPC, you must modify THREE places:
1. `src/shared/types.ts` — params interface
2. `src/shared/rpc-schema.ts` — typed contract
3. `src/main/plugin-system/PluginManager.ts` — `buildRpcHandlers()` mapping (OF OFTEN MISSED)

---

## 3. Chicken-and-Egg Migration Problem

**Symptom**: A migration in `core-context-extractor` that fixes the plugin's own stale `_plugin_state` row (`UPDATE _plugin_state SET enabled = 1 WHERE plugin_id = 'core-context-extractor'`) never executes.

**Root cause**: The migration lives inside `onLoad()`. But `onLoad()` is never called because the plugin is disabled (`enabled=0`). The migration can't fix the state that prevents the migration from running.

**Fix**: Instead of fixing via migration, fix in `PluginManager.register()` itself. When registering a plugin whose manifest says it should be enabled but the DB row says disabled, update the row immediately and add to `enabledPlugins`:

```typescript
} else if (row.enabled === 0 && (manifest.essential || manifest.enabledByDefault !== false)) {
  this.db.run("UPDATE _plugin_state SET enabled = 1 WHERE plugin_id = ?", [manifest.id]);
  this.enabledPlugins.add(manifest.id);
}
```

**Lesson**: Never put a self-healing migration inside a plugin that the migration is trying to heal. Plugin registration (`register()`) is the correct place to reconcile manifest intent with persisted state.

---

## 4. Void RPC Responses Crash the API Logger

**Symptom**: `TypeError: Cannot read properties of undefined (reading 'slice')` when calling void RPCs like `reportUnsavedState`.

**Root cause**: The `req()` wrapper in `src/renderer/rpc/api.ts` unconditionally logs:

```typescript
console.log("[api] RPC <-", method, JSON.stringify(result).slice(0, 120));
```

`JSON.stringify(undefined)` returns `undefined` (not a string), and `.slice()` on `undefined` throws.

**Fix**: Guard against `undefined`:

```typescript
const summary = result === undefined ? "(void)" : JSON.stringify(result).slice(0, 120);
console.log("[api] RPC <-", method, summary);
```

**Lesson**: `JSON.stringify(undefined)` returns `undefined`, not `"undefined"`. Any RPC with `response: void` in the schema will trigger this. Always guard logging for void/undefined results.

---

## 5. Extraction Completion → Profile Viewer Transition

**Symptom**: After extraction completes, the output panel shows "Extraction done" message but never transitions to the foldable ProfileViewer.

**Root cause**: In `OutputPanel`, the check order was:

```typescript
if (extraction) {
  return <ExtractionView />;  // ← BLOCKS everything below
}
if (protagonistProfile || worldOntology) {
  return <ProfileViewer />;   // ← never reached while extraction state exists
}
```

`completeExtraction()` sets both `extraction.complete = true` AND `protagonistProfile = result`, but the first `if (extraction)` check still matches and returns `ExtractionView` before reaching the `ProfileViewer` check.

**Fix**: Check extraction completion first:

```typescript
if (extraction) {
  if (!extraction.complete) {
    return <ExtractionView />;  // in-progress
  }
  if (protagonistProfile || worldOntology) {
    return <ProfileViewer />;   // done with data → show result
  }
  return <ExtractionView />;   // done without data → show status
}
```

**Lesson**: When a state transition adds data to multiple store fields simultaneously, check ordering in conditional rendering chains matters. Always transition away from the "processing" view when data arrives.

---

## 6. Save/Discard for Non-Tree Operations

**Symptom**: Extraction results don't trigger Save/Discard buttons, leaving data in the DB but with no way to commit or discard.

**Root cause**: Missing two integration points:
1. The extraction RPC names were not in `mutatingOps` array in `src/main/index.ts`, so `ensureBackup()` was never called.
2. The renderer never called `store.markModified()` after extraction, so `unsavedCount` stayed at 0.

**Fix**: Added `protagonistExtract`, `worldOntologyExtract`, `bridgeExtract`, `novelProfileSave` to `mutatingOps`. Called `store.markModified()` in `completeExtraction()`.

**Lesson**: Any RPC that writes to SQLite needs two things: the handler name in `mutatingOps` AND a `store.markModified()` / `store.setNonTreeUnsaved()` call on the renderer side after success.

---

## 7. Fire-and-Forget RPC + Streaming Pattern

**Context**: Extraction RPCs return `{ success: true }` immediately, and results stream back asynchronously via `extractionChunk`/`extractionDone` messages. This avoids 60s RPC timeouts during long LLM calls.

**Design decision**: Same pattern as `agentRun` and `workshopStart`. The RPC handler:
1. Validates inputs synchronously, returning early errors
2. Launches async extraction as fire-and-forget (no `await`)
3. Returns `{ success: true }` immediately
4. Progress/results arrive via `ctx.sendMessage()` → renderer message handlers

**Lesson**: This pattern requires the renderer to be stateful — it must track in-progress extractions and not assume a request-response contract. The `extraction` state in the store serves as the coordination point.

---

## 8. Multi-Column DB Updates Without Nullifying Neighbors

**Context**: The initial implementation used a single prepared statement to update all 3 profile columns (`novel_profile`, `protagonist_profile`, `world_ontology`) at once. When saving only a protagonist profile, the other two columns were set to `null`.

**Fix**: Separate `db.run()` calls per column, never touching columns that aren't being updated:

```typescript
// Save protagonist profile only — leave novel_profile and world_ontology untouched
db.run("UPDATE projects SET protagonist_profile = ?, updated_at = ? WHERE id = ?", [json, ts, id]);
```

**Lesson**: An `UPDATE projects SET a = $a, b = $b, c = $c` statement is fragile when callers only intend to modify one column. Use column-specific UPDATEs unless all columns are always modified together.

---

## 9. Profile Column in Project Row Mapping

**Context**: `projectsList` and `projectGet` handlers in `core-data-layer` manually constructed return objects from DB rows. Adding 3 new columns (`novel_profile`, `protagonist_profile`, `world_ontology`) required updating the row mapping function to parse JSON text columns.

**Fix**: Added `mapProjectRow()` with a `jsonOrNull()` helper that safely parses JSON columns:

```typescript
function jsonOrNull(text: unknown): any | null {
  if (typeof text !== "string" || !text.trim()) return null;
  try { return JSON.parse(text); } catch { return null; }
}
```

**Lesson**: Any new TEXT column that stores JSON must have explicit parsing in the row mapping layer. Raw DB strings with `null` or `""` must be handled gracefully.

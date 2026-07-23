# Agent Instructions for NovelCraft Roaming

## Git Workflow — CRITICAL

**The agent is NEVER permitted to run `git commit`, `git push`, `git tag`, `git add`, `git tag -f`, `git checkout`, `git reset`, `git clean`, or any other git mutation command.** This is non-negotiable. Violating this rule overwrites the user's version history without consent.

### The only valid workflow for committing:

```
1. Agent completes code changes
2. Agent shows git diff to user
3. Agent says "Review and test the changes. Ready to commit?"
4. Agent STOPS and waits — does NOTHING until user responds
5. User explicitly says "commit" or provides a commit command
6. Agent runs ONLY the commit command the user approved
```

### What does NOT count as commit approval:

- "do it" — means implement the code, NOT commit it
- "ok" — means the user read what you wrote, NOT "proceed to commit"
- Any message that does not contain the literal word "commit" is NOT commit approval

### After implementing code:

1. **Stop.** Do not commit. Do not tag. Do not create a numbered `[X.Y.Z]` CHANGELOG header.
2. **Always** append relevant bullet points to the `[Unreleased]` section of CHANGELOG.md (see Changelog Hygiene below).
3. Show the diff.
4. Say: *"Changes are ready. Review and test them. Let me know when to commit and what version/tag to use."*
5. Wait for the user's explicit commit instruction.

### When the user DOES ask to commit:

- Ask for the **version number** and **commit type** (feat/fix/chore).
- Do NOT assume a version. The user decides.
- If the user says "commit as vX.Y.Z", ask whether to create/update the tag too.
- After commit, do NOT push unless explicitly asked.

## Build & Test Workflow — CRITICAL

The agent works in `C:\Coding\mindscape-roaming\novelcraft-roaming\` (workspace). The user tests in `C:\Coding\novelcraft-roaming\` (test dir) by manually copying `src` and `build`. The agent must NEVER run `electrobun dev` directly — only the user does.

**After every build**, remind the user:
```
Copy src + build to C:\Coding\novelcraft-roaming\, then run bun run dev there.
```

The agent must NOT read files from the test directory's `build\` folder to verify compilation — it's always stale from a previous build. Verify the workspace `build\` instead.

## Version Recording & Releases

- **Never create a release version, update CHANGELOG.md with a numbered `[X.Y.Z]` header, or add a git tag without explicit user approval.**
- You may append individual changes as bullet points to the `[Unreleased]` section without asking.
- Adding a new `## [X.Y.Z] - DATE` header to CHANGELOG.md requires the user to specify the version number.
- Moving a git tag (`git tag -f`) requires the user to explicitly say "move the tag."
- Do not assume a bug-fix or feature warrants a version bump.

## Changelog Hygiene

After completing **any** task — new features, bug fixes, refactoring, documentation, performance improvements, etc. — the agent MUST append relevant bullet points to the `[Unreleased]` section of `CHANGELOG.md`. The user reviews these and decides when to move them into a numbered `[X.Y.Z]` release section.

### What to record:
- New features with plugin name, category, and one-line summary
- Bug fixes with the symptom and root cause
- Behavioral changes or deprecations
- Build/tooling changes that affect the developer workflow

### What NOT to record:
- Pure formatting / whitespace changes
- Internal refactors with no user-facing or developer-facing impact
- Temporary debug logging commits (the debug code is removed before commit anyway)

### Format:
Use the existing `[Unreleased]` structure — nest under `### Added`, `### Changed`, `### Fixed`, `### Removed` subsections as appropriate. Match the writing style of existing entries (bold plugin/module name, concise description).

## Data Integrity — File Safety

The agent is absolutely forbidden from performing any operation that can **overwrite, delete, or cause loss of user file content**. This includes:

- `git checkout -- <file>` — overwrites working tree file with index version, wiping uncommitted changes
- `git reset --hard` — resets working tree and index, destroying all uncommitted work
- `git clean -f` / `git clean -fd` — deletes untracked files/directories
- `rm`, `del`, `Remove-Item` — deletes files
- `mv`, `move`, `Rename-Item` in overwrite mode
- Shell redirection `> file` or `Set-Content file` — overwrites files silently
- `git restore <file>` — same effect as `git checkout -- <file>`
- Any `Write` tool call that overwrites a file the user has manually edited

**Before any command that touches the filesystem beyond the files the agent itself just wrote, ASK THE USER.**

The agent must treat every uncommitted file as the user's property. The agent has NO authority to discard, overwrite, or restore any file without explicit user confirmation.

If the agent discovers it made an unauthorized edit to a file, it must **tell the user** — never try to silently undo it with `git checkout` or similar.

## PowerShell Environment

This project runs on **Windows PowerShell**. Multi-line `git commit` messages must use PowerShell's backtick-newline syntax (`` `n ``), **not** bash-style `\n` or PowerShell block strings with literal newlines. For example:

```powershell
git commit -m "first line`n`nsecond paragraph`n  - bullet"
```

**CRITICAL**: Always use **double quotes** (`"..."`). Single quotes (`'...'`) are literal strings and do not expand `` `n ``. The commit message must **never** contain a literal `"` character — if quoting a label or term, rephrase to avoid it.

## Debounce Standard

**All search/input debounce MUST use the shared utility at `src/renderer/utils/debounce.ts` with a uniform 500 ms delay.** Inline `setTimeout` / `clearTimeout` patterns are forbidden.

```typescript
import { debounce } from "../../utils/debounce";

const doSearch = debounce(async (q: string) => {
  // API call, DOM updates, etc.
}, 500);

inputEl.addEventListener("input", () => {
  const q = inputEl.value.trim();
  if (!q) { /* clear results immediately */ return; }
  doSearch(q);
});
```

- **No exceptions.** Every text-input search field in the entire project must go through this utility at 500 ms.
- **Immediate clear on empty** is still permitted before calling the debounced function.
- If a new debounce utility is ever introduced (e.g. `useDebounce`), it must also enforce 500 ms by default.

## Save/Discard Mechanism

The app uses a backup-based save/discard flow. All database-modifying operations MUST be listed in the `mutatingOps` array in `src/main/index.ts`. Before executing, `ensureBackup()` copies the database to a `.backup` file (if one doesn't already exist). Without this, changes cannot be discarded.

**When adding a new mutating RPC**, add its handler name to the `mutatingOps` array.

**Read-only RPCs** (`projectsList`, `fragmentsList`, `chaptersList`, `configGet`, `listPlugins`, `getLlmLogs`, `hasBackup`, etc.) should NOT be listed.

**After mutating API calls**, call `store.markModified()` so the toolbar shows Save/Discard buttons:

```typescript
const res = await api.fragmentsCreate({ ... });
if (res.success && res.data) {
  store.markModified();
}
```

### How It Works

```
Operation → ensureBackup() → DB write → store.markModified()
  ↓
Toolbar shows Save (N) / Discard
  ↓
Save  → commitSave()   → deletes .backup file → clears unsaved state
Discard → restoreFromBackup() → restores .backup → clears unsaved state
```

## Main↔Renderer Message Bridge

Messages from main to renderer (`streamChunk`, `streamDone`, `streamError`, `workshopStateChanged`) use Electrobun's RPC transport:

- **Main side**: `BrowserView.defineRPC({ handlers: { messages: { ... } } })` must declare message handler stubs
- **Render side**: `Electroview.defineRPC({ handlers: { messages: { ... } } })` registers the actual handlers
- **Sending**: `pluginManager.setSendMessage()` must be called BEFORE `pluginManager.loadAll()`, using a mutable deferred reference (`rpcSend`) that gets assigned after `BrowserWindow` creation
- **API**: `(novelcraftRPC as any).send(channel, payload)` — NOT `mainWindow.sendMessage()` or `mainWindow.rpc.send()`, neither of which exist

## Debug Logging

- The agent cannot read `console.log` output from the renderer's DevTools — every log line must be manually relayed by the user.
- When debugging, the main process logs appear in the terminal. Use `console.log("[prefix]", ...)` and ask the user to paste the terminal output.
- The LLM Logs download button (`getLlmLogs` RPC → blob download) already covers prompt/response transparency. For new debugging needs, follow the same pattern.
- Remove all debug logging before committing the fix.

## Preact Signals in Root-Rendered Components

Render plugins use `render(Component, container)` which creates independent Preact roots. `@preact/signals` auto-tracking does NOT work in these roots. Every root-rendered component MUST use the `forceUpdate` pattern:

```typescript
function MyComponent() {
  const [, forceUpdate] = useState(0);
  useEffect(() => store.state.subscribe(() => forceUpdate(n => n + 1)), []);
  // read store.state.value.* here
}
```

## Corrupted Input Detection

The user's input box has a known bug: it can inject the agent's thinking process into the user's typed text, corrupt paste headers, or split the user's Chinese characters across the injected content. This produces inputs that are visibly not what the user intended.

### Signs of corrupted input:
- Chinese text suddenly interrupted by a block of English (the agent's thinking process leaked in)
- Truncated paste markers (e.g., `[Pas` instead of `[Pasted ~N lines]`)
- A sentence visibly split into two halves that don't connect
- The input reads as unnatural, incoherent, or doesn't parse as one person's complete thought

### Mandatory response:
When the agent detects ANY of the above patterns in the user's input, it MUST:
1. **Stop immediately.** Do not try to guess, interpret, or act on the corrupted input.
2. **Ask the user:** "你的消息好像被输入框的 bug 打乱了，能不能再说一遍？"
3. Do NOT proceed until the user confirms or re-sends a clean input.

The agent must treat corrupted input the same way it treats a corrupted file — unknown content, not to be processed.

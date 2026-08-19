# Hook Event Support Survey Conclusion

## Last updated

August 2026 — event casing, handler types, and plugin-manifest wiring re-verified against vendor
docs. Everything else still dates from June 2026.

## Question

What hook events do Claude Code, Cursor, GitHub Copilot CLI, and Codex (OpenAI) support for session-start and post-install lifecycle points? What invocation models are available? Are there hooks that fire less than once per session? Are there throttling or frequency controls?

## Verdict

### Session-start hooks

All four vendors have a session-start hook. Event names diverge in casing:

| Vendor | Event name | Fires on resume? | Notes |
|---|---|---|---|
| Claude Code | `SessionStart` | Yes (source field: `startup`, `resume`, `compact`, `clear`) | command + mcp_tool only |
| Cursor | `sessionStart` | Unclear — fires "per new composer conversation"; no documented resume concept | command (shell) only |
| GitHub Copilot CLI | `sessionStart` or `SessionStart` | Yes ("new or resumed session") | shell command + HTTP + prompt |
| Codex | `SessionStart` | Yes (startup, resume, clear, compact) | command only |

Casing summary: Claude Code and Codex use **PascalCase**. Cursor uses **camelCase**. Copilot CLI
accepts **both**, and the casing chosen is what selects the payload format: a camelCase event name
gets Copilot's native payload, a PascalCase one gets the "VS Code compatible format" and, for
`PreToolUse`, Claude's matcher semantics rather than Copilot's native regex rule (E-COPILOT-04). The
June record read the two casings on that page as a documentation inconsistency; they are a deliberate
dual format, so a PascalCase hooks file reaches Copilot CLI unchanged.

### Post-install / post-update hooks

**None of the four vendors has a post-install or post-update hook.** This is a gap across the entire landscape.

- **Claude Code:** Feature requested in issue #11240, closed as duplicate of an earlier request. No implementation as of June 2026.
- **Cursor:** No `postInstall` or `onInstall` event in the 1.7 hooks spec.
- **GitHub Copilot CLI:** Not mentioned anywhere in the hooks reference or tutorials.
- **Codex:** Not in the hooks reference. Plugin manifest bundles only SessionStart and other session-lifecycle events.

The closest approximation is Claude Code's `Setup` hook, which runs only when explicitly invoked via `claude --init-only`, `--init`, or `--maintenance`. It does not fire automatically on plugin install or update. It must be manually triggered by the developer or a CI pipeline.

### Hooks that fire less frequently than every session

| Vendor | Hook | Frequency | Notes |
|---|---|---|---|
| Claude Code | `Setup` | On-demand only (`--init-only`, `--init`, `--maintenance` flags) | Not automatic; no "once per install" |
| Cursor | `workspaceOpen` | Once per workspace open + on workspace folder change | Less frequent than sessionStart |
| GitHub Copilot CLI | — | None documented below per-session frequency | — |
| Codex | — | None documented below per-session frequency | — |

Neither `Setup` (Claude Code) nor `workspaceOpen` (Cursor) is triggered by plugin install or update — they are triggered by user or workspace actions.

### Invocation models

| Vendor | Supported models | Notes |
|---|---|---|
| Claude Code | command, http, mcp_tool, prompt, agent | SessionStart and Setup: command + mcp_tool only |
| Cursor | command (shell), prompt | JSON over stdio; no HTTP, agent, or mcp_tool. Cloud agents run command hooks only (E-CUR-04) |
| GitHub Copilot CLI | command (shell), HTTP POST, prompt | prompt is CLI-only and fires on `sessionStart` (E-COPILOT-04) |
| Codex | command only | prompt and agent types parsed but skipped (not yet implemented) |

Claude Code has the most complete invocation model. Codex lags behind — only shell commands work
despite the schema supporting more. Cursor gained `type: "prompt"` since the June survey, which
recorded it as command-only (E-CUR-04).

### Plugin-manifest hook wiring

All four vendors wire hooks the same way at the manifest level and diverge in the file the manifest
points at.

| Vendor | Manifest field | Accepts | Default location | Hooks file shape |
|---|---|---|---|---|
| Claude Code | `hooks` | path, array of paths, or inline object | `hooks/hooks.json` | `{ "hooks": { Event: [ { matcher?, hooks: [handler] } ] } }` (E-CC-05) |
| Codex | `hooks` | path, array of paths, inline object, or array of inline objects | `hooks/hooks.json` | same three-level nesting as Claude Code; no `version` field (E-CODEX-03) |
| Cursor | `hooks` | path or inline object | `hooks/hooks.json` | `{ "version": 1, "hooks": { event: [handler] } }` — handlers are flat, each carrying its own `matcher`; there is no matcher-group level (E-CUR-04) |
| GitHub Copilot CLI | `hooks` | path or inline object | `hooks.json` or `hooks/hooks.json` | `{ "version": 1, "hooks": { event: [handler] } }` (E-COPILOT-05) |

Two consequences for a build that derives one hooks file per vendor. Claude Code and Codex share the
canonical shape, so a hooks file authored for Claude Code reaches Codex unchanged apart from handler
types Codex cannot run. Cursor's shape differs structurally, not just in casing: a matcher group
holding three handlers becomes three flat entries each repeating the matcher.

### Frequency and throttling controls

| Vendor | Controls | Notes |
|---|---|---|
| Claude Code | `async`, `asyncRewake` modifiers; per-event timeouts; `once` in skill frontmatter | No general throttle; `once` is not a hook modifier |
| Cursor | `loop_limit` on stop/subagentStop (default 5, configurable) | No general throttle |
| GitHub Copilot CLI | `timeoutSec` per hook | No throttle or `once` |
| Codex | Per-hook timeout (default 600s); concurrent execution of multiple matching hooks | No throttle or `once` |

No vendor provides a "once per day" or "once per version" frequency control. The closest thing is a manual workaround: write a sentinel file in the hook script and check for its existence on each run.

## Confidence

High for session-start event names, invocation models, and plugin-manifest wiring (backed by official
docs for all four vendors, re-verified August 2026).
High for "no post-install hook exists" on all four vendors (absence is confirmed by docs + feature request).
High for Copilot CLI casing — both casings are accepted and the page says what each selects (E-COPILOT-04);
this supersedes the June "medium, likely a typo" reading.
Medium for Cursor sessionStart resume behavior (not explicitly documented).

## Strongest support

- Official hooks reference pages for all four vendors confirm event names (E-CC-01, E-CUR-01, E-COPILOT-01, E-CODEX-01)
- Claude Code issue #11240 confirms PostInstall does not exist and has been requested (E-CC-03)
- Codex docs explicitly state "only command handlers run today" (E-CODEX-01)

## Strongest counterevidence

- The June reading of the Copilot CLI reference page as internally inconsistent (E-COPILOT-03) is
  withdrawn — the page documents both casings on purpose (E-COPILOT-04)
- Claude Code `Setup` hook could be used as a post-install workaround if the install process calls `claude --init-only` — but this is a manual integration, not an automatic lifecycle event

## Not supported

- No evidence that any vendor automatically fires a hook when a plugin is installed or updated
- No evidence that any vendor has a "once per day" or "per-version" frequency control
- No evidence that Cursor `sessionStart` fires on conversation resume (the concept may not exist in Cursor)

## Thin evidence

- Whether GitHub Copilot CLI's `sessionStart` distinguishes new vs. resumed sessions via a `source` field (like Claude Code and Codex do)
- What the duplicate Claude Code issue for PostInstall lifecycle hooks is, and its current status
- Whether Codex `prompt` and `agent` hook types have a planned implementation timeline

## Recheck triggers

- When Claude Code ships a PostInstall or plugin lifecycle hook (watch issue tracker)
- When Cursor 1.8+ is released (hooks are beta in 1.7; API may change)
- When Codex enables `prompt` and `agent` handler types
- If GitHub Copilot CLI stops accepting PascalCase event names, or changes what that casing selects
- If Cursor's hooks schema version moves past `1`, or its flat handler shape gains a matcher-group level

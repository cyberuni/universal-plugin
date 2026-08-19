# Evidence

## Claim E-CC-01

Date: 2026-06-06
Status: supports
Confidence: high

Source:
- Label: Claude Code plugins reference (official)
- URL: https://code.claude.com/docs/en/plugins-reference.md
- Type: official docs

Notes:
- Claude Code SessionStart fires at session start/resume; Setup fires only on explicit --init-only/--init/--maintenance flags
- Both SessionStart and Setup support only `command` and `mcp_tool` (not http, prompt, or agent)
- Full event table confirmed: 32 lifecycle events total

## Claim E-CC-02

Date: 2026-06-06
Status: supports
Confidence: high

Source:
- Label: Claude Code hooks reference (official)
- URL: https://code.claude.com/docs/en/hooks
- Type: official docs

Notes:
- Five invocation models: command, http, mcp_tool, prompt, agent
- async, asyncRewake modifiers for command hooks
- Timeouts: 600s default, 30s for UserPromptSubmit, 10s for MessageDisplay
- `once` modifier exists in skill/agent frontmatter but is NOT a general hook modifier

## Claim E-CC-03

Date: 2026-06-06
Status: supports
Confidence: high

Source:
- Label: GitHub issue #11240 — Plugin Lifecycle Hooks request
- URL: https://github.com/anthropics/claude-code/issues/11240
- Type: issue tracker

Notes:
- Request for PostInstall, PreInstall, PostUninstall, PreUninstall hooks
- Closed as duplicate — no PostInstall hook exists in Claude Code as of June 2026
- The duplicate target issue is not identified in this research

## Claim E-CC-04

Date: 2026-06-06
Status: supports
Confidence: medium

Source:
- Label: Claude Code Setup hooks guide (third-party)
- URL: https://claudefa.st/blog/tools/hooks/claude-code-setup-hooks
- Type: blog / third-party analysis

Notes:
- Setup hook described as "on-demand pre-session initialization"
- Does not run automatically with each normal session
- CI/CD use: --init-only runs hook and exits cleanly with return code
- Not a true post-install hook: must be manually invoked, not triggered by plugin install

## Claim E-CUR-01

Date: 2026-06-06
Status: supports
Confidence: high

Source:
- Label: Cursor hooks reference (official)
- URL: https://cursor.com/docs/hooks
- Type: official docs

Notes:
- sessionStart fires when "a new composer conversation is created"
- workspaceOpen fires "once when Cursor opens a workspace and again on every workspace folder change"
- No postInstall or onInstall events exist
- Only shell command invocation model (JSON over stdio)
- loop_limit on stop/subagentStop (default 5)

## Claim E-CUR-02

Date: 2026-06-06
Status: supports
Confidence: high

Source:
- Label: Cursor plugins reference (official)
- URL: https://cursor.com/docs/plugins/building
- Type: official docs

Notes:
- Confirms same event list as hooks reference
- No install-time lifecycle hooks in plugin manifest

## Claim E-CUR-03

Date: 2026-06-06
Status: mixed
Confidence: medium

Source:
- Label: Cursor hooks deep dive (GitButler blog)
- URL: https://blog.gitbutler.com/cursor-hooks-deep-dive
- Type: third-party analysis

Notes:
- As of Cursor 1.7, hooks are in beta; APIs may change
- Documented only 6 hooks (older snapshot); official docs show 21 as of June 2026
- Confirms JSON-over-stdio invocation model
- No throttling controls mentioned

## Claim E-COPILOT-01

Date: 2026-06-06
Status: supports
Confidence: high

Source:
- Label: GitHub Copilot hooks reference (official)
- URL: https://docs.github.com/en/copilot/reference/hooks-configuration
- Type: official docs

Notes:
- sessionStart fires on new or resumed session
- Supports additionalContext field in stdout JSON
- No postInstall hook
- timeoutSec parameter per hook
- Shell command and HTTP invocation models documented

## Claim E-COPILOT-02

Date: 2026-06-06
Status: supports
Confidence: high

Source:
- Label: GitHub Copilot hooks how-to (official)
- URL: https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/use-hooks
- Type: official docs

Notes:
- Confirmed event list: sessionStart, sessionEnd, userPromptSubmitted, preToolUse, postToolUse, errorOccurred, agentStop
- Hook config loaded when CLI starts
- No plugin-bundled hook distinction documented

## Claim E-COPILOT-03

Date: 2026-06-06
Status: mixed
Confidence: medium

Source:
- Label: GitHub Copilot hooks reference page (official)
- URL: https://docs.github.com/en/copilot/reference/hooks-configuration
- Type: official docs

Notes:
- Reference page shows both `sessionStart` (camelCase) and `SessionStart` (PascalCase) in the same document
- Tutorial pages consistently use camelCase
- Likely a documentation inconsistency; camelCase is the authoritative casing based on tutorial page
- Contradicts the stated "camelCase for Copilot CLI" finding in prior research; no actual contradiction — both point to camelCase, the PascalCase appearance may be a typo

## Claim E-CODEX-01

Date: 2026-06-06
Status: supports
Confidence: high

Source:
- Label: Codex hooks reference (official)
- URL: https://developers.openai.com/codex/hooks
- Type: official docs

Notes:
- SessionStart fires at startup, resume, clear, compact
- Only `type: "command"` handlers run; prompt and agent handlers are parsed but skipped
- No PostInstall or OnInstall hook
- Default 600s timeout
- Multiple matching hooks for same event run concurrently
- Hooks stable as of v0.124.0 (April 2026)

## Claim E-CODEX-02

Date: 2026-06-06
Status: supports
Confidence: high

Source:
- Label: Codex build plugins guide (official)
- URL: https://developers.openai.com/codex/plugins/build
- Type: official docs

Notes:
- Plugin hooks use same event schema as regular hooks
- Plugin hooks receive PLUGIN_ROOT and PLUGIN_DATA env vars
- Installing/enabling a plugin does NOT auto-trust hooks; user must review and trust explicitly
- No PostInstall event in plugin manifest

## Claim E-CC-05

Date: 2026-08-18
Status: supports
Confidence: high

Source:
- Label: Claude Code plugins reference (official)
- URL: https://code.claude.com/docs/en/plugins-reference.md
- Type: official docs

Notes:
- Manifest field is `hooks`, typed `string|array|object`: a path, an array of paths, or an inline object
- "Location: `hooks/hooks.json` in plugin root, or inline in plugin.json"
- Hooks file shape is three-level: event name → matcher group (`matcher`, `hooks`) → handler (`type`)
- Handler types re-confirmed: command, http, mcp_tool, prompt, agent
- Event names re-confirmed PascalCase; the reference lists 32 events including `SessionStart`

## Claim E-CUR-04

Date: 2026-08-18
Status: refutes
Confidence: high

Source:
- Label: Cursor hooks reference (official)
- URL: https://cursor.com/docs/hooks
- Type: official docs

Notes:
- Refutes the June finding that Cursor supports command handlers only: `"type": "prompt"` now exists —
  "Prompt hooks use an LLM to evaluate a natural language condition."
- `type` defaults to `command`; no http, agent, or mcp_tool handler exists
- "Cloud agents run command-based hooks only. Prompt-based hooks require authentication wiring between
  the hook and the agent loop, which isn't available in the cloud execution environment."
- Hooks file carries a top-level `"version": 1` alongside `"hooks"`
- Handler entries are flat under the event name and carry their own `matcher`; there is no matcher-group level
- Event names re-confirmed camelCase (`sessionStart`, `preToolUse`, `afterFileEdit`, `workspaceOpen`)
- Plugin manifest field is `hooks`, "Path to hooks config file, or inline hook config", default `hooks/hooks.json`
  (https://cursor.com/docs/plugins/building)

## Claim E-CODEX-03

Date: 2026-08-18
Status: supports
Confidence: high

Source:
- Label: Codex hooks reference (official)
- URL: https://learn.chatgpt.com/docs/hooks
- Type: official docs

Notes:
- The June URL (https://developers.openai.com/codex/hooks) now 308-redirects here
- Handler types unchanged: "Only `type: \"command\"` handlers run today. `prompt` and `agent` handlers
  are parsed but skipped."
- Three-level structure re-confirmed: event → matcher group → handlers; no top-level `version` field
- Event names re-confirmed PascalCase (`SessionStart`, `PreToolUse`, `PostToolUse`, `Stop`, …)
- Plugin manifest field is `hooks`; it accepts a single path, an array of paths, an inline hooks object,
  or an array of inline hooks objects, and defaults to `hooks/hooks.json`
  (https://developers.openai.com/codex/plugins/build)

## Claim E-COPILOT-04

Date: 2026-08-18
Status: refutes
Confidence: high

Source:
- Label: GitHub Copilot hooks reference (official)
- URL: https://docs.github.com/en/copilot/reference/hooks-configuration
- Type: official docs

Notes:
- Refutes E-COPILOT-03's reading of the two casings as a documentation inconsistency. The page states:
  "Two payload formats are supported, selected by the event name used in the hook configuration:
  camelCase format… VS Code compatible format—Configure the event name in PascalCase (for example,
  `SessionStart`)."
- The casing also selects matcher semantics: "Hooks configured with the PascalCase event name
  `PreToolUse`—as used in Claude Code plugins and the Open Plugins format—apply Claude's matcher
  semantics instead of the native regex rule"
- Handler types: command (shell), HTTP POST, and prompt; prompt is CLI-only and fires on `sessionStart`
- Hook sources load in order: policy, user, project, then plugins — "Hooks contributed by installed
  plugins — declared by each plugin in its own `hooks.json` (or under `hooks/hooks.json`) inside the
  plugin's installation directory."

## Claim E-COPILOT-05

Date: 2026-08-18
Status: supports
Confidence: high

Source:
- Label: GitHub Copilot CLI plugin reference (official)
- URL: https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference
- Type: official docs

Notes:
- Plugin manifest field is `hooks`, typed `string | object` — a path or an inline hooks object
- Expected locations inside a plugin: `hooks.json` or `hooks/hooks.json`
- Manifest search order re-confirmed: `.plugin/plugin.json` → `plugin.json` → `.github/plugin/plugin.json`
  → `.claude-plugin/plugin.json`

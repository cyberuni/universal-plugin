# Changes — Copilot CLI spec-mode component namespace

## 2026-09-07 — Initial research

- **What changed**: First investigation. Established that the canonical `$schema` moves Copilot CLI's
  native components from the plugin root into `com.github.copilot/`, and that the namespace replaces
  rather than supplements the root.
- **Why**: Found while researching #62 and filed as
  [#67](https://github.com/cyberuni/universal-plugin/issues/67). Every plugin universal-plugin builds
  declares the canonical `$schema`, so the tool was shipping plugins whose agents Copilot CLI never
  loaded, silently.
- **Conclusion change**: N/A (initial).
- **What this round added over the issue**: the runtime's own `changelog.json` as a first-party
  source, which raises commands, rules, hooks and extensions from "asserted by a blog post" to
  "named by the runtime"; `lsp.json`, which the issue missed; the 1.0.80-0 version boundary; and the
  unresolved "MCP config" wording, recorded as an open question rather than acted on.
- **Triggered by**: Issue #67.

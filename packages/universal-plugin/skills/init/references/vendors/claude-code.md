# Claude Code

Reads `.claude-plugin/plugin.json`. **The build derives it** — never hand-edit it.

```bash
npx universal-plugin plugin build --vendor claude-code
```

## What lands in the derived manifest

The shared metadata from the canonical top level, plus the component paths, plus whatever
`extensions["org.cyberuni.universal-plugin"].harnesses["claude-code"]` sets. `$schema`, `extensions`,
`vendors`, `packagePath`, and `harnesses` are universal-plugin's own orchestration — they never
appear in a vendor manifest.

An empty `"claude-code": {}` is the normal case: it opts into the build with no overrides.

## Extra requirements

None beyond `name`. Claude Code loads a manifest that carries only the shared metadata.

## Skills

Claude Code reads the skills the manifest's `skills` path names. The build additionally rewrites each
`SKILL.md`'s frontmatter when the skill declares `invocation-policy` — `disable-model-invocation:
true` for `user`, `user-invocable: false` for `model`. See [`../frontmatter.md`](../frontmatter.md).

## Hooks

Author hooks once, in canonical form: **PascalCase** event names (`SessionStart`, `PreToolUse`,
`PostToolUse`, `Stop`, `UserPromptSubmit`) over Claude Code's matcher-group shape. That is what the
canonical schema admits, and `plugin build` derives the rest (ADR-0011).

Claude Code and Codex read that form as authored. Copilot CLI accepts it too — PascalCase selects its
Claude-compatible payload format. Cursor is the one vendor translated: it gets
`.cursor-plugin/hooks.json` with camelCase events, `"version": 1`, and each matcher group flattened
into one entry per handler, and its derived manifest points there.

**A handler type the vendor cannot run is dropped, and the build warns.** Claude Code runs `command`,
`http`, `prompt`, and `agent`; Codex runs `command` only; Cursor runs `command` and `prompt`; Copilot
CLI runs `command`, `http`, and `prompt`. Read the warnings — a plugin whose only `SessionStart`
handler is `http` reaches Claude Code and Copilot CLI and nothing else. Copilot CLI reads the
canonical file directly, so its unsupported handlers are reported as ignored at runtime rather than
dropped from a derived file.

Source: `.research/hook-event-survey/conclusion.md` (re-verified August 2026) — re-verify against
vendor docs before relying on it.

## Leave alone

Output styles are Claude Code-only, and hook blocks in `.claude/settings.json` are settings, not
plugin content. Report them; do not convert them.

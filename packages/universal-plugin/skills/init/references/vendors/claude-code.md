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

Claude Code hook events are **PascalCase** (`SessionStart`, `PreToolUse`, `PostToolUse`, `Stop`,
`UserPromptSubmit`). Cursor and Copilot CLI use camelCase; Codex is PascalCase like Claude Code.

**The build does not translate event names.** It copies the `hooks` path through to every derived
manifest as declared, so one `hooks/hooks.json` cannot currently satisfy both casings. Author hooks
for the runtimes that share a casing, and say plainly which runtimes a hooks block does not reach
rather than implying portability the build does not deliver.

Source: `.research/hook-event-survey/conclusion.md` (June 2026) — re-verify against vendor docs
before relying on it.

## Leave alone

Output styles are Claude Code-only, and hook blocks in `.claude/settings.json` are settings, not
plugin content. Report them; do not convert them.

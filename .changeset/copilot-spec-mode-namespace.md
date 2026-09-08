---
"universal-plugin": minor
---

`plugin build` now derives the `com.github.copilot/` component tree, so a plugin's agents reach
GitHub Copilot CLI.

`plugin init` always writes the canonical `$schema`, which puts every plugin this CLI builds into
Copilot CLI's spec mode. Spec mode reads the runtime's native components — agents, commands, rules,
`hooks/hooks.json` and `lsp.json` — **only** under `com.github.copilot/`, and no longer from the
plugin root. The build derived nothing for `copilot-cli`, so every plugin it shipped loaded none of
them on Copilot CLI, with no warning from anywhere. Skills kept working, which is what made it easy
to miss.

Authoring does not move. You keep declaring `agents`, `commands`, `rules`, `hooks` and `lspServers`
at their canonical locations, and the build derives the namespace tree from them: the directory kinds
are copied — with agents renamed to Copilot CLI's `.agent.md` convention, since the canonical
`agents/` is the Claude Code-shaped `*.md` and a file under the other name is ignored — the hooks file
is translated (so a handler Copilot CLI cannot run is now dropped from a
real derived file rather than reported as ignored at runtime), and a declared `lspServers` **path**
is copied to `com.github.copilot/lsp.json`. An **inline** `lspServers` map is not delivered — the
file's top-level shape is undocumented, so the build warns rather than guessing. `skills/` and
`mcp.json` do not move and are not copied. `com.github.copilot/extensions/` runs the other way: it is
authored there, passed through untouched, and left alone by `--clean`.

`copilot-cli` now reports `built` at `com.github.copilot/` when it derives any of this, and still
reports `canonical` at `plugin.json` when the plugin declares none of the moved kinds. Its manifest
is unchanged — root `plugin.json` still serves it, so a `harnesses.copilot-cli` override and a
`pinToPluginVersion` MCP entry are still undelivered and still warn. `plugin init --npm` wires
`com.github.copilot/` into `package.json` `files`.

`doctor` gains `copilot-root-components`: components sitting at the plugin root with no namespace
copy, which is the shape of the defect above.

Verified against `@github/copilot-linux-x64` 1.0.83; the move landed in Copilot CLI 1.0.80-0. The
published CLI plugin reference still describes the old layout and is stale. Recorded as ADR-0015,
with the evidence and its confidence under `.research/copilot-spec-mode-namespace/`.

Closes #67

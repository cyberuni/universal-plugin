# Conclusion — Copilot CLI spec-mode component namespace (September 2026)

## Question

When a plugin declares the canonical Agent Plugins `$schema`, where does GitHub Copilot CLI load its
native components from — the plugin root, or the `com.github.copilot/` namespace directory?

## Verdict

**Declaring the canonical `$schema` moves Copilot CLI's native components out of the plugin root.**
In spec mode Copilot CLI reads them **only** from `com.github.copilot/`:

| Component | Spec-mode path | Root path still read? |
| --- | --- | --- |
| Custom agents | `com.github.copilot/agents/` | no |
| Commands | `com.github.copilot/commands/` | no |
| Rules | `com.github.copilot/rules/` | no |
| Hooks | `com.github.copilot/hooks/hooks.json` | no |
| LSP servers | `com.github.copilot/lsp.json` | no |
| Extensions (canvases) | `com.github.copilot/extensions/` | n/a — namespace-only from the start |
| Skills | `skills/` | **yes — skills do not move** |
| MCP servers | `mcp.json` | **yes — see open question** |

The namespace **replaces** the root for the kinds that move; it does not supplement it. One tree
therefore cannot serve both a native-mode and a spec-mode Copilot CLI consumer for those kinds.

The change landed in Copilot CLI **1.0.80-0** and is labelled a breaking change by the runtime's own
changelog. `com.github.copilot/extensions/` arrived one release earlier, in 1.0.79.

## Why it matters here

`plugin init` always writes the canonical `$schema`, so every plugin universal-plugin builds is in
spec mode. Before this finding the build derived nothing for Copilot CLI and reported it with status
`canonical`. Any plugin shipping agents, commands, rules, hooks, or LSP servers therefore loaded
none of them on Copilot CLI, with no warning from this tool.

## Confidence

- **Agents** — proven by controlled A/B against the shipped runtime (see [evidence](./evidence.md) E01).
- **Commands, rules, hooks, LSP, extensions** — first-party, from the changelog that ships inside
  `@github/copilot-linux-x64` (E02, E03). Not separately reproduced by experiment.
- **Skills stay at root** — proven by experiment (E01) and consistent with the changelog's list.

## Open question

The 1.0.80-0 changelog carries a second entry saying spec plugins that leave "commands, agents,
rules, hooks, LSP or MCP config at the plugin root now report the file and where to move it". Its
mention of **MCP config** is not matched by the breaking entry, which omits `mcp.json` from the list
of paths that move. The likely reading is that it refers to Copilot's *native* MCP filenames
(`.mcp.json`, `.github/mcp.json`) rather than the spec's root `mcp.json`, which Copilot CLI has read
since 1.0.74. Treat root `mcp.json` as still correct, and re-check when the CLI plugin reference
documents spec mode — its "Open Plugin Spec support" section is still an empty bullet list.

Verified on linux-x64 only. Whether VS Code and the Copilot app resolve the same subdirectory set is
asserted by GitHub's GA post, not tested here.

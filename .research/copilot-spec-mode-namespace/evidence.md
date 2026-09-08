# Evidence Log — Copilot CLI spec-mode component namespace

## E01 — Spec mode stops Copilot CLI reading agents from the plugin root

- **claim_id**: E01
- **date**: 2026-09-05
- **status**: Confirmed
- **confidence**: High
- **source.label**: Controlled A/B against `@github/copilot-linux-x64` 1.0.83, linux-x64
- **source.url**: https://github.com/cyberuni/universal-plugin/issues/67
- **source.type**: Experiment
- **notes**: Isolated `HOME`, one variable changed at a time, same agent file throughout.

  | `$schema` | agent file at | loads |
  | --- | --- | --- |
  | absent | `agents/x.agent.md` | yes |
  | canonical | `agents/x.agent.md` | no |
  | canonical | `agents/x.agent.md` + explicit `"agents": "agents/"` | no |
  | canonical | `com.github.copilot/agents/x.agent.md` | yes |

  Observed `Plugin activation [agents]: plugins=5, loaded=4`, the sole non-contributor being the
  spec-mode plugin with root `agents/`. An explicit `agents` path in the manifest does not rescue it.
  A probe shipping both `skills/rootskill/` and `com.github.copilot/skills/nsskill/` reported
  `Installed 1 skill.` — the namespace is not a generic component root, and skills do not move.

---

## E02 — The runtime's own changelog names the exact set of paths that move

- **claim_id**: E02
- **date**: 2026-09-07
- **status**: Confirmed
- **confidence**: High
- **source.label**: `changelog.json` shipped in `@github/copilot-linux-x64` 1.0.83, entry for 1.0.80-0
- **source.url**: https://www.npmjs.com/package/@github/copilot-linux-x64/v/1.0.83
- **source.type**: Vendor artifact (first-party, ships with the binary)
- **notes**: Two entries, quoted verbatim:

  > `[removed]` Breaking: Agent Plugins spec plugins now read commands/, agents/, rules/,
  > hooks/hooks.json, lsp.json, and extensions/ only under com.github.copilot/ — no longer from the
  > plugin root

  > `[improved]` Spec plugins that leave commands, agents, rules, hooks, LSP or MCP config at the
  > plugin root now report the file and where to move it, instead of losing the component silently

  The first entry is the authoritative list. `skills/` and `mcp.json` are absent from it. The second
  entry's "MCP config" is unexplained by the first — recorded as the open question in
  [conclusion.md](./conclusion.md). Backing PR: github/copilot-agent-runtime#15077.

---

## E03 — Extensions were namespace-only from their introduction

- **claim_id**: E03
- **date**: 2026-09-07
- **status**: Confirmed
- **confidence**: High
- **source.label**: `changelog.json` shipped in `@github/copilot-linux-x64` 1.0.83, entry for 1.0.79
- **source.url**: https://www.npmjs.com/package/@github/copilot-linux-x64/v/1.0.83
- **source.type**: Vendor artifact (first-party)
- **notes**: > `[added]` Agent Plugins spec plugins can now ship extensions under a
  > com.github.copilot/extensions/ directory

  Extensions never had a root path to lose, so unlike the other kinds they are a pass-through rather
  than a relocation. Backing PR: github/copilot-agent-runtime#14865.

---

## E04 — GitHub's GA post corroborates the namespace across all three clients

- **claim_id**: E04
- **date**: 2026-09-07
- **status**: Confirmed
- **confidence**: Medium
- **source.label**: Agent Plugins 1.0 in VS Code, Copilot CLI, and the Copilot app
- **source.url**: https://github.blog/changelog/2026-08-12-agent-plugins-1-0-in-vs-code-copilot-cli-and-the-copilot-app/
- **source.type**: Official blog
- **notes**: "Move Copilot-specific files into the `com.github.copilot/` directory, which other
  clients ignore." Custom agents, commands, rules and hooks load from there across VS Code, Copilot
  CLI and the Copilot app; the CLI and app also load extensions such as canvases. Confidence is
  medium only for the cross-client claim — VS Code and the Copilot app were not tested. The post
  frames the namespace as keeping one package portable, which reads as supplementing the root; the
  runtime changelog (E02) is explicit that it replaces it. Where they disagree, E02 wins.

---

## E05 — The CLI plugin reference still documents none of this

- **claim_id**: E05
- **date**: 2026-09-07
- **status**: Confirmed
- **confidence**: High
- **source.label**: GitHub Copilot CLI plugin reference
- **source.url**: https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference
- **source.type**: Official docs
- **notes**: Documents the native layout only — `agents/`, `skills/`, `commands/`, `hooks.json` or
  `hooks/hooks.json`, `.mcp.json` or `.github/mcp.json`, `lsp.json` or `.github/lsp.json`, all
  "overridable in manifest". It says declaring `$schema` opts into Open Plugin Spec v1.0.0
  "additively on top of standard plugin loading", which **contradicts** E01 and E02: additive would
  mean root paths keep working, and they do not. The section that would explain spec mode is an empty
  bullet list. The docs are stale relative to the shipped runtime; do not build against them here.

---

## E06 — An explicit manifest path does not opt back into root loading

- **claim_id**: E06
- **date**: 2026-09-05
- **status**: Confirmed
- **confidence**: High
- **source.label**: Row 3 of the A/B table in E01
- **source.url**: https://github.com/cyberuni/universal-plugin/issues/67
- **source.type**: Experiment
- **notes**: `"agents": "agents/"` in a spec-mode manifest still loads nothing. The namespace is not
  a default that a manifest path overrides — it is where spec-mode resolution starts. This rules out
  "declare the root path explicitly" as a cheaper fix than deriving the directory.

---

## E07 — Copilot CLI agent files carry the `.agent.md` extension

- **claim_id**: E07
- **date**: 2026-09-07
- **status**: Confirmed
- **confidence**: High
- **source.label**: Creating and using custom agents for GitHub Copilot CLI
- **source.url**: https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-custom-agents-for-cli
- **source.type**: Official docs
- **notes**: "Each custom agent is defined by a Markdown file with an `.agent.md` extension"; an agent
  is selected by "the file name of the custom agent profile, without the `.agent.md` extension".
  This is native-mode behavior the namespace inherits — the moved location changes where the runtime
  looks, not what it recognizes. It matters here because the canonical `agents/` layout is the Claude
  Code-shaped `*.md`, so a copy that kept the authored name would land a file Copilot CLI ignores.
  Cited in preference to the plugin reference (E05), which this research treats as stale.

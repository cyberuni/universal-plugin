---
status: active
cr: github-67
source: https://github.com/cyberuni/universal-plugin/issues/67
project: universal-plugin
project-path: packages/universal-plugin
todos:
  - content: "Research: verify which component kinds move under the namespace, and in which version"
    status: completed
  - content: "Explore: decide Copilot's vendor class, the derived tree's shape, and the ADR-0011 knock-on"
    status: pending
  - content: "Spec: ADR-0015 + plugin/build README/feature + glossary; doctor SKILL.md findings"
    status: pending
  - content: "Spec gate: judge the build.feature diff (two frozen copilot scenarios are rewritten)"
    status: pending
  - content: "Deliver: derive com.github.copilot/ in src/build; pass authored extensions through"
    status: pending
  - content: "Deliver: doctor check for native components left at the plugin root"
    status: pending
  - content: "Deliver: fix examples/copilot-cli/terraform; update apps/web copilot layout docs"
    status: pending
  - content: "Impl gate: verify each new frozen scenario"
    status: pending
  - content: "Handoff: changeset, PR closing #67"
    status: pending
---

# github-67 — Copilot CLI reads its components from `com.github.copilot/`

`plugin init` always writes the canonical `$schema`, so every plugin this tool builds is in Open
Plugin Spec mode. In that mode Copilot CLI reads its native components **only** under
`com.github.copilot/` — the plugin root is no longer read for them. The build derives nothing for
`copilot-cli` today, so every plugin it ships loads no agents, commands, rules, hooks, or LSP servers
on Copilot CLI, silently.

## Evidence

Captured at [`.research/copilot-spec-mode-namespace/`](../../../../.research/copilot-spec-mode-namespace/conclusion.md).
Agents proven by A/B against the shipped 1.0.83 runtime; the moved set (`commands/`, `agents/`,
`rules/`, `hooks/hooks.json`, `lsp.json`, `extensions/`) and its 1.0.80-0 boundary come from the
changelog that ships inside the binary. `skills/` and `mcp.json` do **not** move.

## Decision

Copilot CLI stops being the zero-file `canonical` case and becomes a derived-output vendor: the
build derives the `com.github.copilot/` tree from the canonical manifest. Its **manifest** stays
canonical — root `plugin.json` still serves it, so a `harnesses.copilot-cli` override is still
undeliverable. Recorded as ADR-0015.

## NEXT

Write ADR-0015 and revise the `plugin/build` node against it.

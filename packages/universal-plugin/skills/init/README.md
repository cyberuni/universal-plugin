# init skill

Give a project one canonical `plugin.json` on the [Agent Plugins
Specification](https://agent-plugins.org), then derive the manifest each runtime expects — Claude
Code, Cursor, Codex, and GitHub Copilot CLI.

## What it does

The skill runs a five-phase workflow: survey what the project already has, classify each finding,
confirm the plan, apply it, then verify and report.

It detects what is already there — a canonical manifest, hand-written vendor manifests, a legacy root
manifest, publicly-shipped skills with no manifest at all — and either adopts it onto the standard,
rebuilds it, or reports it as something to leave alone. It never rewrites a file the user authored
without asking first.

## Why the derivation step is small

Copilot CLI reads the canonical `plugin.json` directly, so nothing is generated for it. Only Claude
Code, Cursor, and Codex get a derived manifest, and the difference between them is a handful of
vendor-specific fields under `harnesses.<vendor>`.

`references/standard.md` defines the baseline every plugin gets. `references/vendors/<vendor>.md`
covers what one runtime needs on top of it, and `SKILL.md` routes to them directly rather than
loading all four.

## Routes

Phase 4 routes to exactly one reference:

| Route | Reference | Covers |
| --- | --- | --- |
| Create | [`references/create.md`](./references/create.md) | scaffold a new plugin with chosen vendors and components |
| Adopt | [`references/adopt.md`](./references/adopt.md) | put an existing vendor-specific plugin, or already-shipped skills, onto the open standard |
| Update | [`references/update.md`](./references/update.md) | add or remove a vendor or a component |

Three neighbours own the rest of the plugin's life, each named for what it does: `doctor` diagnoses,
`version` moves the number, `remove-plugin` deletes. This skill is the one that writes the manifest.

## The part that needs care

Deriving a manifest is easy; keeping a skill's *behavior* identical across runtimes is not. Each
runtime parses the frontmatter fields it knows and silently drops the rest, so anything that must
hold everywhere belongs in the Markdown body. See `references/frontmatter.md`, which also documents
`invocation-policy` — the one field this build acts on, by rewriting the authored `SKILL.md`.

## Boundaries

Plugin authoring only. Setting a repository up to *consume* skills — `AGENTS.md`, the
`.agents/skills/` layout, per-harness bridges — is `buddy-agent-harness:init`. This skill does not
touch CI, repository settings, or unrelated project files.

## References

- [Spec](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/spec.md)
- [Schema](https://raw.githubusercontent.com/cyberuni/universal-plugin/refs/heads/main/schema/v1.json)
- [Examples](https://github.com/cyberuni/universal-plugin/tree/main/examples)

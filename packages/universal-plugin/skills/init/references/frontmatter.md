# Skill frontmatter across runtimes

A plugin's skills are the one component every runtime reads, so their frontmatter is where
cross-vendor behavior is won or lost. Each runtime parses the fields it knows and silently drops the
rest.

## Required, everywhere

```yaml
---
name: release-checklist
description: Runs the release checklist. Use when cutting a release or publishing a package version.
---
```

- `name` — 1–64 characters, lowercase letters, digits, hyphens. **Match the parent directory name**;
  Claude Code resolves the command from the directory and treats `name` as a label, so matching them
  removes the discrepancy.
- `description` — say what the skill does *and* when to use it. This is the only text most runtimes
  see when deciding whether to load it.

Two failures actually cost you the skill: a missing `description`, and YAML that does not parse. The
usual cause of the second is an unquoted colon — quote any description containing one.

## `invocation-policy` — the field this build acts on

universal-plugin reads `invocation-policy` from each `SKILL.md` and projects it per vendor:

| Value | Meaning | What the build does |
| --- | --- | --- |
| `both` (default) | user- and model-invocable | nothing |
| `user` | explicit invocation only | writes `disable-model-invocation: true` into the skill's frontmatter |
| `model` | model-invocable only, not user-facing | writes `user-invocable: false`, and emits no Codex prompt |

Two consequences worth knowing before you run a build:

- **The build rewrites the authored `SKILL.md`** to carry those flags. That file is both source and
  artifact for this one field. Expect it in the diff; it is not a stray edit.
- Any value other than `user`, `model`, or `both` **fails the build** rather than being ignored.

## Which runtime understands which field

| Field | Recognized by |
| --- | --- |
| `name`, `description` | all |
| `license`, `metadata`, `compatibility` | accepted broadly, largely ignored |
| `allowed-tools` | most |
| `disable-model-invocation` | Claude Code, Cursor |
| `context: fork`, `agent:` | Claude Code only |
| `paths`, legacy `globs` | Cursor only |
| `model` | Copilot CLI only |
| `argument-hint`, `arguments` | Claude Code only |

`argument-hint` and `arguments` are the one group that fails loudly rather than quietly: claude.ai
uploads and the Skills API reject fields outside the standard set. A skill that takes arguments and
also ships through those paths cannot use them — and does not need to, because no runtime but Claude
Code substitutes anything anyway. Claude Code appends what the caller typed as `ARGUMENTS: <value>`
when the body has no `$ARGUMENTS`, so a body that says how to read the invocation works everywhere,
while a `$ARGUMENTS` placeholder resolves on one runtime and stays literal on the rest.

## The rule that follows

Anything that must hold on every runtime belongs in the Markdown body, not only in a vendor-specific
field. The body is the one part every runtime reads. Treat vendor frontmatter as an optimization
layered on instructions that already work without it.

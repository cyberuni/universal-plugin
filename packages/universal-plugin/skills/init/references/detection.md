# Detection

What to look for during the survey, and where each finding belongs.

```bash
ls -d .claude-plugin .cursor-plugin .codex-plugin .github/plugin .plugin 2>/dev/null
test -f plugin.json && cat plugin.json
find . -name SKILL.md -not -path '*/node_modules/*' -not -path './.git/*'
ls .mcp.json .lsp.json hooks/ commands/ agents/ rules/ output-styles/ 2>/dev/null
```

| What you find | What it means | Bucket |
| --- | --- | --- |
| root `plugin.json` with `$schema` on `agent-plugins.org` **and** an `extensions` object | already on the open standard | canonical |
| `.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/` manifest **below** a canonical root | build output | derived |
| a vendor manifest with **no** canonical root `plugin.json` | a vendor-specific plugin | adoptable |
| root `plugin.json` with neither `$schema` nor `extensions` | a legacy single-vendor manifest now sitting on the canonical path | adoptable |
| publicly-shipped skills and no manifest of any kind | skills shipped without a plugin | adoptable |
| `harnesses["copilot-cli"]` carrying fields | no delivery path — the canonical schema is closed | undeliverable |
| `.claude/skills/`, `.agents/skills/`, `.cursor/rules/` | the project's own tooling | not a plugin |
| `.github/plugin/plugin.json` | a path older builds wrote; shadowed by root and no longer generated | stale, safe to delete |

For every vendor manifest found, record its path and **every field it sets**. Adoption reproduces
all of it, and the Phase 5 diff is checked field by field.

## Which skills count as public

Only a skill the project *distributes* belongs to a plugin.

| Location | Public? |
|----------|---------|
| `skills/<name>/SKILL.md` at the plugin root | Yes |
| `<package>/skills/<name>/SKILL.md` where `package.json` `files` ships it | Yes |
| `.claude/skills/`, `.agents/skills/`, `.cursor/rules/` | **No** — repo-private tooling |

If the only skills are in private locations, say nothing about adoption. A repository that configures
its own agents is not a plugin waiting to happen; `buddy-agent-harness:init` is the skill for that
side of the line.

## Making the adoption offer

State what you found, what adoption buys, and let the user decline:

> This project has a Claude Code plugin manifest but no canonical `plugin.json`. I can convert it to
> the open Agent Plugins Specification, so one manifest drives Cursor, Codex, and Copilot CLI too —
> Claude Code keeps working exactly as it does now. Want me to?

Offer once. If the user declines, or their request was already something specific and unrelated
(inspecting status, removing manifests), drop it and do what they asked.

## Choosing vendors

Ask which runtimes the plugin targets; default to all four when the user is unsure. Enabling a vendor
costs a derived manifest and nothing else — except Codex, which additionally requires `version` and
`description` on the canonical manifest and fails the build without them.

Enabling Copilot CLI writes no file at all. Say so, rather than letting the user read a missing
manifest as a broken build.

Detecting a vendor directory means there is configuration to reconcile. It does not by itself mean
the user wants that vendor maintained — say which vendors you are enabling and why, and let them
correct the part that is actually variable.

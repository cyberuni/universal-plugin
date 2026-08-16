# AGENTS.md

This file provides guidance to AI coding assistants when working with code in this repository.

## Feature Planning

Use GitHub issues for feature planning by default. At the end of a brainstorming or design session, create a GitHub issue (via the `create-issue` skill) to capture the spec. Reference the issue number when resuming work in a future conversation.

## Commit Discipline

**Auto-commit rule:** When a unit of work is complete and verified, commit it immediately. Do not wait for the user to ask. Batching multiple units into one commit, or finishing all work before committing, are both violations of this rule.

**Unit of work:** one coherent, independently revertable change. That means one domain's refactor, one feature, one bugfix, one test suite expansion for one concern, or one config change. Never two unrelated concerns in the same commit. A TDD red-green-refactor cycle alone is not a commit boundary; commit when the full intended change is complete and tests pass. If the working tree has unrelated changes, leave them unstaged, commit the current unit first, then continue.

- Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- One concern per commit; never batch unrelated changes
- Stage only files for this unit: `git add <files>`, then verify with `git diff --cached`
- Never use `git add .`, `git add -A`, or `git add -p` (interactive commands agents cannot run)
- Never commit with red tests; run validation commands first

### References

- **`commit-work` skill.** Staging, splitting, and message writing when committing.

## Skill Augmentations

When loading any skill, also check `.agents/skills/<name>/SKILL.md` for project-level additions and merge them with the base skill. Files in `.agents/skills/` extend (not replace) the installed skill.

## Project overview

`universal-plugin` builds cross-runtime AI agent plugins. An author writes one canonical
`plugin.json`, and the CLI generates the manifest each runtime expects: Claude Code, Cursor, Codex,
and GitHub Copilot CLI.

The CLI is published to npm from `packages/universal-plugin`. The [root README](README.md) states
the problem it solves and links the research behind it. Do not restate research conclusions here;
link to them.

## Where things live

| Path | Holds |
| --- | --- |
| `packages/universal-plugin/src` | CLI source, one folder per domain concept |
| `packages/universal-plugin/.agents/spec` | The behavior specification, including ADRs under `design/decisions` |
| `packages/universal-plugin/skills` | Skills the plugin ships |
| `.research/<topic-slug>` | Vendor findings, one folder per topic |
| `apps/web` | The documentation site |

`packages/universal-plugin/AGENTS.md` carries the architecture rules for the CLI source. Read it
before changing anything under `src`.

## Research structure

Each topic under `.research/<topic-slug>/` holds four files:

- `conclusion.md`. The current best answer. Read this first.
- `topic.md`. The full investigation record.
- `evidence.md`. Claims logged with source URLs and confidence.
- `changes.md`. Dated update history.

Findings are dated June 2026. A claim about a vendor decays, so check `evidence.md` for the source
URL and re-verify against vendor documentation before you rely on one. The [root
README](README.md#research) lists every topic and the question it answers.

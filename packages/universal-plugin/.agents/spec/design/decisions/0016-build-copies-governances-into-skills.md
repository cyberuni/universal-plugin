# 0016 — `plugin build` copies governances into the skills that use them

**Status:** accepted
**Date:** 2026-09-17
**Builds on:** [0002](./0002-governance-scope-model.md) — its resolution order, which answers where a
governance is *found*; this answers when a skill *reads* one.
**Upstream:** the owner's decision of 2026-09-17 on
[repobuddy/buddy-agent-harness#122](https://github.com/repobuddy/buddy-agent-harness/issues/122),
whose design note this records for the half that lands here.

## Context

A skill reads a governance today by running a command: `npx cyberplace@<version> governance show
skill-design` and its two siblings in `universal-plugin` and the retired `cyber-skills`. A count
across the owner's checkouts on 2026-09-16 found about 470 of these calls.

Every one is a registry lookup on a document that does not change while the skill runs, and on a
cold machine it is a download. The skill cannot work without network, and the runtime the agent
happens to be in has to have a package runner on `PATH`. What the pin buys — the skill reads the
version it was tested against — is real, and it is the only thing the call buys.

Nothing about that guarantee requires a command. The version a skill was tested against is known at
build time, which is the one moment the owning package, the skill, and the pin are all in hand.

## Decision

`plugin build` copies each governance into every skill that uses it, at
`<skill>/references/governances/<name>.md`. The skill reads that file. No plugin needs a CLI at run
time to read a governance.

Five boundaries make the step safe to run on every build:

1. **The files are the declaration.** The `.md` files already present in
   `<skill>/references/governances/` declare which governances that skill uses. To use one, an
   author adds its file there; the build rewrites it from its owner. Nothing is declared in
   `plugin.json` — a second place to say it is a second place for it to be wrong, and the folder has
   to exist either way.
2. **The owner ships the document.** A governance is a plain Markdown file at `governances/<name>.md`
   in the package that owns the subject. The build resolves a name against the plugin being built
   first, then the packages its `package.json` declares — a governance owner is installed as a dev
   dependency of the repository being built. The plugin wins, so a plugin that ships a governance is
   never overwritten by a published copy of its own document.
3. **Transitive, and one level deep.** Governances reference each other, and the Agent Skills
   specification asks that `SKILL.md` reference every file the agent needs directly, without chains.
   So the build copies every governance a copy references, rewrites each `governance show <other>`
   pointer inside a copy into "load `references/governances/<other>.md` if it is not already loaded",
   and fails when `SKILL.md` does not list a copy under References.
4. **The copies are committed.** This is the exception to keeping build output out of git, which
   stands for script bundles. A copy is small text, and a git-sourced install — every Copilot CLI
   and Cursor install, and every organization-distributed Claude Code marketplace — needs the skill's
   default to work with no network at all. `plugin build --check` writes nothing and exits non-zero
   naming each copy that differs from its source, and `pnpm verify` runs it.
5. **Unresolvable is an error, not a warning.** A declared file that names no governance, and a
   pointer with no copy to point at, both fail the build. The rewritten pointer names a sibling file
   by path; a warning would leave the skill shipping a path to a file that does not exist, which the
   agent discovers at the moment it needs the document.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| Keep the run-time `governance show` call | It is the thing being replaced. It pays a registry lookup per read for a guarantee the build can give for free, and it makes every skill that reads a rule set need network and a package runner. |
| Declare the governances in `plugin.json` | Two places to state the same fact, and the folder still has to hold the files. The owner settled this: the files are the declaration. |
| Gitignore the copies and generate them on install | There is no install step for a git-sourced plugin, which is how Copilot CLI, Cursor, and organization-distributed Claude Code marketplaces take one. The default would be missing exactly where no fallback exists. |
| One shared copy per plugin instead of one per skill | A skill is the unit that is installed, read, and tested; a plugin-level folder is not one level deep from any `SKILL.md`. The cost is disk, not context — a copy costs nothing until an agent opens it. |
| Report drift from `doctor` rather than failing a check | `doctor` is the home for drift nobody can repair automatically. A stale copy has one correct answer and the build already computes it, so reporting it would ask the author to run the command that could have fixed it. |
| Warn on an unresolvable name and skip the copy | It ships a rewritten pointer to a file that was never written. The failure moves from the build machine, where it is one line to fix, to the agent that opened the skill. |

## Consequences

- A plugin author depends on `universal-plugin` at build time only. A user of the plugin installs
  nothing extra, and nothing runs from the network while a skill works.
- A governance fix reaches a skill when its plugin is rebuilt and released. This is what the pinned
  `npx` calls it replaces already guaranteed; the copy just stops paying for it per read.
- `BuildResult` grows a `governances` list (`skill`, `name`, `path`, `owner`, `status`), reported
  beside the vendor rows when a plugin declares any, so a refresh is visible rather than a silent
  write into a skill folder.
- A skill folder is now write-territory for the build, which it already was for
  `invocation-policy` frontmatter.
- `universal-plugin governance show` is unaffected by this decision and still resolves by
  [0002](./0002-governance-scope-model.md)'s order. #122 retires it in a later step, in favour of
  `buddy-agent-harness governance show --overrides-only` for the override layers; that is a separate
  change.

# 0017 — Retire `governance` and the build's copy step for `reference` and `load-reference`

**Status:** accepted
**Date:** 2026-09-27
**Supersedes:** [0002](./0002-governance-scope-model.md), the scope model of a command this retires,
and [0016](./0016-build-copies-governances-into-skills.md), the build's governance copy step.
**Upstream:** [repobuddy/buddy-agent-harness#152](https://github.com/repobuddy/buddy-agent-harness/issues/152),
the references epic. This is its fourth child, [#95](https://github.com/cyberuni/universal-plugin/issues/95).

## Context

Two mechanisms in this package answered "how does a skill read a governance":

- `universal-plugin governance show|list` resolved a name across the managed, project, local, user,
  and package scopes (ADR-0002).
- `plugin build` copied each governance a skill declared into `<skill>/references/governances/`, and
  `plugin build --check` failed CI when a committed copy drifted from its source (ADR-0016).

`buddy-agent-harness` now owns this. Its `reference show|list|search` command resolves a name across
the managed, project (`<root>/.agents/references/`, then `<root>/.agents/governances/`), user, and
plugin tiers. The plugin tier is `buddy-agent-harness` itself plus every package the project's
nearest `package.json` declares, read from `<package>/references/`. Its `load-reference` skill is the
one way a skill loads a reference: it runs a launcher bundled in its own `scripts/` folder, and falls
back to the calling skill's own `references/<name>.md` when a name resolves nowhere. A calling skill
writes one line naming the reference, the skill, and the plugin in words.

With a resolver that runs from a bundled launcher, the reason for committed copies (no network and
no package runner at run time) is met without a build step, and two resolvers would disagree about
which copy wins.

## Decision

1. **`governance` is retired.** For one release every form of it (`show`, `list`, bare) writes on
   stderr that it is retired and the replacement command, names the `load-reference` skill, and exits
   1. It accepts any argument or flag so an old caller gets that message rather than a parse error.
   The following release removes the command.
2. **The build copies nothing.** `plugin build` no longer reads or writes
   `<skill>/references/governances/`, and `--check` is removed. A committed copy is ordinary skill
   content.
3. **The documents this package owns ship under `references/`.** `plugin-design` and
   `slash-invocation` move from `governances/` to `references/`, and `universal-plugin` (a short
   pointer to `plugin-design`, whose only copy lived in the cyberplace repository) is added there. The
   `files` allowlist ships `references/` instead of `governances/`.
4. **This package's skills use the caller line.** Where a skill ran `governance show plugin-design`,
   it now says to load `plugin-design` with the `load-reference` skill in the `buddy-agent-harness`
   plugin.

## Consequences

- A project reaches this package's documents through the plugin tier only when it declares
  `universal-plugin` as a dependency or dev dependency. A skill run elsewhere reports the name as not
  loaded unless it carries its own copy.
- The replacement ships in a `buddy-agent-harness` release. Merging this before that release is on
  npm would leave the deprecation message pointing at a command no one can install.
- `plugin init --scaffold` still creates `governances/`. Scaffolding `references/` instead is a
  separate change.
- Readers in other repositories that run `governance show` or read `references/governances/` copies
  migrate in those repositories.

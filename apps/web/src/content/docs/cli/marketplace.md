---
title: Local marketplace
description: Carry a marketplace catalog in the repository so the plugin can be installed from it before it is published.
---

A repository can carry its own marketplace catalog. Users then add the repository as a marketplace
and install the plugin from it — no service, no submission, no account. During development it is how
you install the plugin the way a user eventually will.

Three commands write these catalogs. [`plugin init`](#plugin-init-registers-one-plugin) registers the
plugin it scaffolds, `marketplace init` derives a catalog for every plugin a repository holds, and
[`marketplace add`](#marketplace-add-lists-a-plugin-that-lives-elsewhere) lists a plugin that lives
somewhere else. All three write the same files; none publishes anything. A fourth,
[`marketplace validate`](#marketplace-validate-checks-what-the-repository-carries), checks that what
they wrote is what each runtime will load.

For the shorter loop that skips the catalog entirely — the working copy dropped straight into a
runtime's local plugin directory — see [`plugin install`](../install/).

## Where each runtime looks

| Runtime | Catalog it reads | Add the marketplace | Install |
|---|---|---|---|
| Claude Code | `.claude-plugin/marketplace.json` | `/plugin marketplace add <owner>/<repo>` | `/plugin install <plugin>@<marketplace>` |
| Codex | `.agents/plugins/marketplace.json`, or the Claude path | `codex plugin marketplace add <source>` | `codex plugin add <plugin>@<marketplace>` |
| GitHub Copilot CLI | `.github/plugin/marketplace.json`, or the Claude path | `copilot plugin marketplace add <spec>` | `copilot plugin install <plugin>@<marketplace>` |
| Cursor | `.cursor-plugin/marketplace.json`, or the Claude path | an admin imports the repository as a team marketplace | Customize sidebar |

Three of the four read `.claude-plugin/marketplace.json`, so one file covers Claude Code, Codex, and
Copilot CLI if you want fewer. Two traps: Codex installs with `plugin add` where Copilot CLI uses
`plugin install`, and Codex finds a catalog only when the file is named `marketplace.json`.

Cursor is the exception. It reads a repository catalog, but nothing on the command line adds one:
a developer tests through `plugin install`, and users get the plugin when an admin imports the
repository from the Cursor dashboard. Generate the file; write no Cursor install command.

## `plugin init` registers one plugin

```bash
universal-plugin plugin init --vendor claude-code --vendor cursor
```

Beside the canonical `plugin.json`, this writes a catalog for each selected vendor at the
**repository** root, each carrying an entry for this plugin:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-marketplace.json",
  "name": "acme-widgets-local",
  "owner": { "name": "acme" },
  "plugins": [{ "name": "my-plugin", "source": "./packages/my-plugin" }]
}
```

The catalog belongs to the repository, not to the plugin: it sits at the repository root and lists
every plugin the repository develops. So it is named after the repository, `<owner>-<repo>-local`,
with `-local` separating it from a published marketplace of the same plugins. `source` is the path
from the repository root to the plugin.

`owner` comes from the canonical manifest's author, else the `package.json` that ships it, else the
account the repository lives under. Every runtime requires it, so a repository offering none of the
three gets no catalog and a line on stderr saying why. The same happens outside a repository.

Pass `--no-marketplace` to skip the step. An `init` with no `--vendor` writes no catalog either.

Re-running `init` folds the entry back in rather than replacing the file. The marketplace name, the
owner, and every other plugin's entry stay as they are, including edits you made by hand — only this
plugin's entry is re-derived.

## `marketplace init` covers a repository

```bash
universal-plugin marketplace init --claude --codex --copilot --cursor
```

This one discovers plugins instead of registering a single one: every `<scan-root>/<dir>/plugin.json`
below `plugins/`, or below each `--plugin-scan-dir` you name. With no target flags it writes all
four catalogs. `--dry-run` prints the plan, and a catalog that differs from what would be generated
stops the run until you pass `--force`, so a hand-edited file is never replaced silently.

Discovery walks directories, so it only speaks for plugins that are in them. An entry whose source
is **not** a local path survives a regeneration untouched, and a discovered plugin whose entry names
a non-local source keeps that source with its derived metadata refreshed around it. So a plugin
shipped through npm keeps pointing at npm, and an entry `marketplace add` wrote is not a deletion
waiting for the next `--force`. What discovery owns it still owns: a local-path entry it no longer
finds is dropped.

## `marketplace add` lists a plugin that lives elsewhere

```bash
universal-plugin marketplace add npm:repobuddy --description "Repo automation"
```

`init` describes the repository. `add` describes everything else, which is what turns a repository
into a curated marketplace rather than only its own plugins' home. One positional says where the
plugin lives, and the command reads it by shape:

| Spec | Source written |
|---|---|
| `./plugins/alpha` | `"./plugins/alpha"` |
| `cyberuni/universal-plugin` | `{ "source": "github", "repo": "cyberuni/universal-plugin" }` |
| `https://example.com/o/r.git` | `{ "source": "url", "url": "…" }` |
| `npm:repobuddy`, `@cyberuni/upx` | `{ "source": "npm", "package": "…" }` |
| `repobuddy@cyberplace` | whatever source that marketplace publishes |

Two shapes collide. `plugins/alpha` reads as a GitHub repository, because `owner/repo` and a relative
path are the same string and reaching for the filesystem would make it mean different things in
different directories — write `./plugins/alpha` or pass `--path`. And a leading `@` is a scope, so
`@cyberuni/upx` is a package while `upx@cyberplace` is a marketplace entry. `--path`, `--npm`,
`--github`, `--url`, and `--from-marketplace` each force the reading.

Only a repository path installs everywhere. Claude Code takes the schema's full tagged set, Codex
takes npm, and Copilot CLI and Cursor take neither:

```
target   status   entry      reason
claude   added    repobuddy
codex    added    repobuddy
copilot  skipped  repobuddy  npm source is not supported by copilot
cursor   skipped  repobuddy  npm source is not supported by cursor
```

A target that cannot resolve the source gets no entry at all. That is the same rule as validation:
a catalog is read in someone else's terminal, so a source a runtime refuses is a failure far from
here.

Nothing is fetched. Metadata comes from the plugin's own `plugin.json` for a path, from an installed
`node_modules` copy for a package, from the entry being copied for a marketplace spec, and otherwise
from `--description`, `--version`, `--homepage`, `--repository`, `--license`, and `--keywords`.

`<plugin>@<marketplace>` has no source type in the schema, so the entry is resolved and copied. The
marketplace has to be readable: one the runtime has already added is found under
`~/.claude/plugins`, and `--from <dir>` names a checkout of one that is not installed.

An entry whose source is a `./` path is **rewritten** rather than copied. That path resolves against
the other marketplace's root, which your repository is not — but it names a location inside a
repository whose URL is known:

| Entry in the other marketplace | Written into your catalog |
|---|---|
| `./plugins/aced` in `cyberuni/cyberplace` | `{ "source": "git-subdir", "url": "https://github.com/cyberuni/cyberplace.git", "path": "plugins/aced" }` |
| `./` in `unional/skills` | `{ "source": "github", "repo": "unional/skills" }` |

The origin comes from what the runtime recorded for that marketplace, falling back to the clone's own
git remote. One with neither stops the run rather than writing a path that resolves nowhere.

The catalog is created if the repository has none, named and owned the way `init` names it —
`--owner` is usually what a curating repository needs, since it has no plugin manifest of its own.
An entry already listed differently stops the run until you pass `--force`.

## `marketplace validate` checks what the repository carries

```bash
universal-plugin marketplace validate
```

A catalog is read at **install** time, in someone else's terminal. This command moves the refusal to
the repository: it reads each catalog and checks it against the schema its runtime loads — the
[official Claude Code marketplace schema](https://json.schemastore.org/claude-code-marketplace.json)
for Claude Code, Cursor, and Copilot CLI, and Codex's own shape for Codex.

Each target is reported `valid`, `invalid`, or `missing`; `--required` makes a missing catalog a
failure. The exit status is 1 when any selected catalog is invalid, and every issue names the key and
the value to write instead:

```
error: catalog ".claude-plugin/marketplace.json" does not match the marketplace schema:
  owner must be an object with a name, not string — write { "name": "Ari Vance" }
  plugins[0].repository must be a string, not object — write "https://github.com/o/r.git"
```

Those two are the shapes that reach a repository unnoticed, because both are what `package.json`
carries: an `owner` string where every runtime requires an object, and an npm `repository` object
where the catalog requires the URL. Generation reduces what it can — an npm `repository` becomes its
URL, and a field it cannot reduce is omitted rather than written — and refuses to write a catalog that
would still be invalid. Validation is what catches the rest: a file edited by hand, or a `./` source
pointing at a directory that is no longer there.

Nothing is repaired. A catalog you edited is yours to correct.

## The version is derived, never written

A catalog entry's version is copied from the canonical manifest of the plugin its `source` resolves
to, at generation time. It is not a second number to maintain: on Claude Code the manifest's version
overrides the entry's silently, and an entry whose manifest declares no version carries none. A
version left behind on an entry is removed the next time the entry is derived.

Move the version with `plugin version <bump>`, or with `publish sync-version` where changesets owns
it. See [ADR-0010](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/design/decisions/0010-version-policy.md).

`plugin build` keeps it that way. Every build re-derives this plugin's entry in each catalog the
repository already carries, for the vendors it is building, so a version move reaches the catalogs
without a second command. It re-derives the metadata, not the distribution: an entry pointing at an
npm package still points there after a build — `plugin version` re-derives through `plugin build`, and so does the
`changeset version → publish sync-version → plugin build` release script. The build creates no
catalog: it refreshes the ones the repository chose to carry and leaves everything else in them
alone. See [ADR-0014](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/design/decisions/0014-build-refreshes-catalogs.md).

## Developing against Codex

Codex installs a **copy** of the plugin, at
`~/.codex/plugins/cache/<marketplace>/<plugin>/<version>`. Editing the plugin's files does not reach
that copy, so a change to anything packaged — a skill, a hook, the manifest — needs two steps:

```bash
codex plugin add <plugin>@<marketplace>   # re-copies the current source
```

Then start a new Codex session. The running one keeps the copy it loaded at startup.

That one `add` is the whole reinstall. Re-running it at the same version overwrites the cached copy,
so neither `codex plugin remove` nor a version bump is required first, and
`codex plugin marketplace upgrade` does nothing for a local marketplace.

The version in that cache path is the one the **plugin's** manifest carries, not the catalog entry's:
Codex installs an entry that declares no version just as happily. Keeping the entry's version equal
to the manifest's is this project's rule rather than Codex's — it stops the catalog from advertising
a version the plugin does not have. Verified against codex-cli 0.147.0; the probes are in
[`.research/local-marketplaces/`](https://github.com/cyberuni/universal-plugin/tree/main/.research/local-marketplaces)
(E-CODEX-M13 to E-CODEX-M17).

## Nothing here is published

These commands write files into the repository. No marketplace is registered, no plugin installed,
nothing authenticated or provisioned. The catalog does its job when someone adds the repository as a
marketplace.

Sources for the per-runtime facts above, including which were run end to end and which were read out
of a shipped build, are in
[`.research/local-marketplaces/`](https://github.com/cyberuni/universal-plugin/tree/main/.research/local-marketplaces).

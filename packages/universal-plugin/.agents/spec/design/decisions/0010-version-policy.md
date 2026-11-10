# 0010 — Version policy: one number, owned by the canonical manifest

**Status:** accepted
**Date:** 2026-08-18
**Amended:** 2026-10-11 — the derive/stamp seam (#179)
**Amended:** 2026-11-09 — release-please with no `package.json` (#238)
**Amended:** 2026-11-09 — release-it (#237)
**Amended:** 2026-11-09 — a release tool, not only `packagePath`, skips `unreleased-content`
**Amended:** 2026-11-09 — the release-please restamp gets CI
**Builds on:** [0007](./0007-adopt-agent-plugins-spec-canonical.md) — its derived-not-authored manifest
model, extended here to the `version` field specifically.

## Context

[0007](./0007-adopt-agent-plugins-spec-canonical.md) settled where the canonical manifest lives and
that every per-harness manifest is derived from it. That decided version **propagation**: one edit
reaches every runtime manifest. It did not decide version **policy** — who picks the next number,
when it has to move, and what a consumer installing from a repository's default branch actually
receives. `.agents/spec/plugin/version/README.md` names that gap explicitly and defers it here.

Three facts bound the decision.

**A runtime's plugin cache is keyed by the version, not by content.** Claude Code resolves a
plugin's version — from `plugin.json` first, the catalog entry second, the source's git commit only
if neither declares one — and skips the update when it matches what is already
installed.[^cc-version] `/plugin marketplace update` refreshes the marketplace clone correctly and
then reports *"already at the latest version"* without re-extracting. A skill added and pushed
without a version bump therefore stays invisible to everyone who already installed the plugin. That cache belongs to the runtime; nothing here proposes changing it. It matters because
it makes the version the **only** signal a consumer sees — content is not a signal at all.

**A plugin that also ships to npm has two numbers with a plausible claim.** `package.json` carries
npm's version, and in this repository — and in most repositories the CLI targets — that number is
owned by changesets, which computes it from the accumulated changeset files at release time. The
canonical `plugin.json` carries the plugin's version. Nothing forces them to agree.

**The version is silent about failure on both sides.** The author sees a successful push. The
consumer sees "already at the latest version". Neither is told the content diverged.

## Decision

### 1. A plugin has exactly one version, and the canonical `plugin.json` owns it

The `version` field of the root `plugin.json` is the plugin's version. Every other version-carrying
artifact in the repository is **derived** from it and is never authored by hand:

| Artifact | Written by |
| --- | --- |
| `.claude-plugin/plugin.json`, `.cursor-plugin/plugin.json`, `.codex-plugin/plugin.json`, root copilot manifest | `plugin build` (derived) |
| Repository-local marketplace catalogs | `plugin build` (derived, [0014](./0014-build-refreshes-catalogs.md)) |
| `npx`/`upx <cli>@<version>` pins in every file under `skills/**`, scripts included | `plugin version` (stamped) |
| `.plugin/pins.json` | `plugin version` (stamped) |
| A marked `mcpServers` invocation's package specifier (`pinToPluginVersion`), in the authored declaration | `plugin version` (stamped) |
| The version embedded in a compiled skill script (#177) | `plugin version` (stamped), once compiled scripts exist |

"Owns" is about the value every artifact reads, not about who chooses it. Choosing is §2.

**Amended (issue #179).** The table above replaces one that split the writes across `plugin build`,
`plugin bundle` and `marketplace init`. No single command wrote every place, so a release could move
one and leave the rest. The table now follows one seam, **derive vs stamp**:

- **Derive: `plugin build`.** It produces each runtime's files from source and never decides a
  version. A derived manifest copies whatever `plugin.json` carries, and a marked `mcpServers` entry
  is copied as authored with only its marker stripped. `build` never reads a `package.json` to pick
  a number, so it can run at any time under any release tool.
- **Stamp: `plugin version`.** It takes a known version and writes it into every stamped place in
  one call, then calls `build` to re-derive the rest. After that one call every place agrees.

`plugin bundle` and `publish sync-version` are deprecated aliases of the stamp. They warn for one
minor release and are then removed. "Bundle" no longer means pinning; producing self-contained skill
scripts (#177) is "compile".

There is no second plugin version. A repository that ships more than one plugin has one canonical
manifest per plugin, each owning its own number.

### 2. `packagePath` decides who picks the next value

The CLI already knows whether a plugin ships to npm: `.agents/universal-plugin.json` declares
`packagePath` when it does. That declaration is the switch.

**No `packagePath` — the author picks, through `plugin version <bump>`.** Nothing else claims the
number. The command writes the canonical manifest and re-derives everything in §1's table.

**`packagePath` declared — the release picks, and the number flows npm → manifest.** The two numbers
are kept equal, and the one that moves first is `package.json`, because changesets already owns it
and already knows what the release contains. `publish sync-version` copies the released number into
the canonical manifest, and `plugin build` re-derives from there. The repository's `version` script
runs the three in that order, so the published tarball and the manifests it contains carry the same
number:

```
changeset version  →  publish sync-version  →  plugin build
```

Running `plugin version` in a changesets repository is a mistake, not an alternative: it picks a
number changesets is about to pick again.

**Amended (issue #179).** The stamp takes the number from one of three sources, and the release tool
decides which one it calls:

| Source | Call | Used by |
| --- | --- | --- |
| Author bump | `plugin version minor` | Plain repositories (no `packagePath`) |
| Explicit number | `plugin version 1.4.0` | semantic-release: `@semantic-release/exec` `prepareCmd`; release-it: `hooks."after:bump"` |
| The package's `package.json` | `plugin version --from-package` | changesets and release-please, after their bump |

**Amended (issue #238).** A fourth source covers release-please with no `package.json`:

| Source | Call | Used by |
| --- | --- | --- |
| The canonical `plugin.json` | `plugin version --from-manifest` | release-please `release-type: simple`, `extra-files` bumping `plugin.json` |

release-please runs with no `package.json`: the simple strategy reads the number from
`.release-please-manifest.json` and writes only `CHANGELOG.md` and a `version.txt` it skips when
absent.[^rp-simple] `extra-files` with a JSON updater moves `plugin.json`'s `$.version`. It offers no
hook to run a command before its release commit,[^rp-customizing] so the release PR moves the
canonical manifest and nothing else.

Two ways to bring the rest along were weighed. Listing every stamped file in `extra-files` was
rejected: the skill pins and the compiled script headers are not a JSON `version` field, so the
generic updater would have to find them by its version-shaped pattern, and the vendor manifests and
catalogs are `plugin build`'s output, which a second writer must not touch (§1). The chosen way is a
CI step on the release PR branch that runs `plugin version --from-manifest` and pushes the stamped
files. That keeps the one stamp. The step runs in the same workflow as the action, gated on its
`prs_created` output, because release-please force-pushes the branch on every update and drops the
earlier restamp commit; the action reports an updated PR there too, so the step restamps again.

`--from-manifest` has no advance guard, for the reason `--from-package` has none. It is refused where
`packagePath` is declared: the package owns the number there, and the call is `--from-package`.
`doctor` reports `release-please-no-restamp` when a release-please config bumps `plugin.json` and no
workflow runs `plugin version`.

**Amended (the restamp gets CI).** The restamp push needs a token that starts workflow runs. A push
made with the default `GITHUB_TOKEN` creates no workflow run; only `workflow_dispatch` and
`repository_dispatch` are exempt.[^gh-token-trigger] The restamp commit is the release PR's head, and
required checks must pass on the head commit, so with the default token the PR can never merge under
a required check. release-please's own PR has the same gap, and its action names a `token` input for
it.[^rp-action-token]

Four ways to start the checks were weighed against two bars: the fewest standing secrets, and checks
that count toward a required check.

| Way | Standing secret | Counts toward a required check |
| --- | --- | --- |
| Re-dispatch CI with `workflow_dispatch` (`gh workflow run`) | none | no: checks from a `workflow_dispatch` run on a PR's head branch do not appear on the PR and do not satisfy a required check[^gh-required-checks] |
| Run the checks inside the release job | none | no: that job runs on the `push` to the default branch, so its check is not on the PR's head commit |
| A personal access token | a long-lived token that acts as a person | yes |
| A GitHub App token from `actions/create-github-app-token` | the App's private key; each token lasts one run | yes |

The chosen way is the GitHub App token. The workflow mints it for the run and passes it to
release-please (`token:`) and to `actions/checkout` (`token:`), so both pushes start the PR's
`pull_request` and `push` runs.[^gh-token-trigger] The workflow's own `GITHUB_TOKEN` then needs only
`contents: read`. The App needs Contents, Pull requests and Issues set to read and write, the
permissions release-please's action asks of its token.[^rp-action-token]

`doctor` reports `release-please-restamp-no-ci` when a workflow runs `--from-manifest` and `git push`
with no other credential: no `actions/create-github-app-token` step, no deploy key, and no `token:`
input other than the default token. The check reads the workflow as text, so any sign of another
credential clears the file. A `workflow_dispatch` re-run does not clear it.

The changesets chain is now `changeset version → plugin version --from-package → plugin build` (the
stamp re-derives through `build` unless given `--no-build`). Only one place picks the number: with
`packagePath` declared, a release type (`plugin version minor`) is refused and names the package to
bump instead. The explicit and `--from-package` forms stay allowed there, because release tools call
them.

semantic-release writes the version only inside its publish run, and `package.json` holds
`0.0.0-development` until then. The stamped files exist only in the published package unless the
release commits them back (`@semantic-release/git`), and the git-sourced channels (Copilot CLI and
GitHub-hosted marketplaces) read `plugin.json` from the repository. The commit-back is therefore
required for those channels; without it they are unsupported under this model. A place still holding
`0.0.0-development` is reported as *unstamped*, not as drift.

**Amended (issue #236).** The release tool's own config carries the wiring for semantic-release,
release-it, and release-please. `plugin init` writes none of it. The `init-universal-plugin` skill
proposes the edit and applies it once the author approves. For semantic-release that means
`@semantic-release/exec` running `plugin version ${nextRelease.version}` in `prepare`, and
`@semantic-release/git` committing the stamped files back. A plugin that ships to no npm package
also drops `@semantic-release/npm`, because that plugin edits `package.json` even with
`npmPublish: false`. The [`plugin/init/`](../../plugin/init/README.md) spec states why this belongs to
the skill and not to a CLI flag.

`doctor` checks the semantic-release side of this wiring. It reads the config semantic-release would
load: the `release` key of `package.json`, then the first `.releaserc*`, `.config/releaserc*` or
`release.config.*` file, the order cosmiconfig 9 searches.[^sr-config] It reports
`semantic-release-no-stamp` when no `prepareCmd` runs `plugin version`. A stamp in a later step, such
as `publishCmd`, runs after `@semantic-release/git` has committed, so it does not count. For a plugin
that ships to no npm package it also reports `semantic-release-npm-unshipped` when the config lists
`@semantic-release/npm`, or names no `plugins` and so gets the default list, which includes it. With
no `package.json` that plugin fails the release with `ENOPKG`.[^sr-npm] The config is read as text,
so a JavaScript config is checked only for what it names. A config that `extends` a shareable config
is not checked, because the wiring may live in the shared one.

**Amended (issue #237).** release-it uses the explicit form. With `"npm": false` it ignores
`package.json` and reads the current version from the latest git tag, falling back to `0.0.0` when
there is none,[^release-it-npm] so a plugin with no package can release with it. Its `after:bump`
hook runs before the release commit and tag, and that commit stages every tracked file the hook
changed,[^release-it-git] so the stamp ships in the tagged commit:

```json
{
  "npm": false,
  "hooks": { "after:bump": "universal-plugin plugin version ${version}" }
}
```

The tag, not `plugin.json`, is where release-it reads the current number. A repository adopting it
tags the commit that carries the current version first; otherwise the first run starts from `0.0.0`
and the stamp refuses a number that does not advance. `doctor` reports a release-it config that
never calls `plugin version` (`release-it-no-stamp`).

The direction differs; the ownership does not. In both models the canonical manifest is what every
derived artifact reads, and `package.json` is a peer that must agree — never an input any derived
artifact consults.

### 3. A marketplace entry's version is derived from the manifest it points at

A catalog entry describes a plugin; it does not version one. Whatever version a catalog entry carries
is copied from the canonical manifest of the plugin its `source` resolves to, at generation time, by
the command that writes the catalog. A hand-authored version in a catalog is a defect, and a catalog
generator must never invent one — an entry whose plugin manifest carries no version carries none
either.

This binds the two queued issues that build on this decision: `init` generating a repository-local
`marketplace.json` (#45) and local Codex marketplace metadata (#29). Both derive; neither authors.

### 4. Any change to shipped content requires the version to move

Because the runtime cache is keyed by the version, a release is exactly a version bump. If a change
alters what a consumer installs — a skill, an agent, a governance file, a manifest field, a bundled
script — the version must move before that change reaches consumers. A content change that ships
without a bump is not a small omission; it is a change that does not exist as far as installed
consumers are concerned.

This is a rule about intent, and it is stated so that tooling and reviewers have something to check
against. §6 covers what is done about it.

### 5. `main` is the release channel; pinning is the consumer's choice, one level up

A consumer installing from a repository gets whatever its default branch holds. Two of the four
runtimes would let an author avoid that by pinning a plugin entry to a tag: Claude Code's `github`,
`url`, and `git-subdir` plugin sources accept `ref` (branch or tag) and `sha` (exact commit), and
Copilot CLI's `github` and `url` sources accept the same
pair.[^cc-marketplaces][^copilot-plugin-ref]

The CLI still emits no ref, because the catalogs it generates cannot carry one. They describe plugins
inside the repository being catalogued, so their entries are repository-relative sources — and a
relative-path source resolves inside whatever clone of the marketplace the consumer already
has.[^cc-marketplaces] The ref that decides what that clone contains is chosen when the consumer adds
the marketplace, not by the author writing the entry: Claude Code accepts a `ref` on a git-based
*marketplace* source, and Codex takes `--ref` on `codex plugin marketplace add`. Cursor has no git
plugin source at all; a Cursor marketplace tracks a branch, and pinning is likewise the consumer's
level.[^cursor-plugins-ref]

So `main` must be releasable at every commit, and §4 is what makes that true. An author who wants
`main` to stay a development target instead tags releases and tells consumers to add the marketplace
at a tag. That is a repository convention, and this CLI neither requires nor encodes it.

### 6. Content that changed without a bump is detected, not prevented — and `doctor` owns the check

Prevention is not available. `plugin build` keeps no record of what it previously wrote, and the
change that strands a consumer is usually not in a manifest at all — it is a new or edited skill,
which no manifest field reflects. A build that failed on it would also have to fail during ordinary
development, when unreleased content is exactly what a working tree is supposed to contain.

Detection belongs to `doctor`, which is where every other drift check already lives (`version-drift`
between the two authored numbers, `stale` for a derived manifest older than the manifest it derives
from) and which is advisory by construction — it exits 0 whether or not it finds anything, so it is
safe on a session-start hook. `doctor` gains a finding that reports shipped content changed since the
commit that set the current version, naming the bump as the repair.

The finding applies to one of §2's two release models. Where `packagePath` is declared the release
picks the number, so content sitting ahead of the last released version is the normal state of a
branch, not a defect — only the author-picks model can forget the bump, and only there does the
check run. It reads git, so it is skipped rather than guessed at where history is unavailable.

**Amended (2026-11-09).** `packagePath` is not the only sign that the release picks the number. A
plugin that ships to no npm package can still be versioned by a release tool, and then the tool moves
the number at release time from what accumulated since the last release, exactly as in the
`packagePath` model. Content sitting ahead of the last release is the normal state there too, and
the repair the finding names (`plugin version <bump>`) would pick a number the tool is about to pick
again. So the check also skips a plugin that one of these tools versions:

| Tool | Detected by | Picks the number from |
| --- | --- | --- |
| changesets | `.changeset/` at the plugin or repository root, and a plugin-root `package.json` that is private or absent | the changeset files |
| release-please | `release-please-config.json` lists this plugin's `plugin.json` in `extra-files` | conventional commits |
| semantic-release | its config where it loads one: `.releaserc*`, `release.config.*`, `.config/releaserc*`, or a `release` key in `package.json`[^sr-config] | conventional commits |
| release-it | `.release-it.{json,yaml,yml,toml,js,cjs,mjs,ts}`, or a `release-it` key in `package.json`, the places `release-it-no-stamp` reads[^ri-config] | its prompt, or the increment it is given |

Each detection is the one the tool's own release-config finding uses, where doctor has one. An
absent plugin-root `package.json` in a changesets repository still counts: changesets is the chosen
release tool, and `changesets-no-package` reports the missing package, so the repair is that file,
not a bump. A `release-please-config.json` that does not bump this plugin's `plugin.json` does not
count: release-please does not version this plugin. The rule is one rule, "a release tool picks the
number", so a tool added later joins the table rather than getting its own exception.

**Amended (issue #164).** `version-drift` now covers all five places, not only the authored pair:
the derived vendor manifests, the repository catalogs and the skill pins are compared too, and each
file left behind is its own finding. `doctor` asks `publish check-version` for the comparison, and
that command exits 1 on drift so a repository can run it in CI — `doctor` itself stays advisory.
Detection on the release PR is what catches a release tool that moved one number and no sync, which
`init` can wire for changesets but not for release-please or semantic-release
([`plugin/version/`](../../plugin/version/README.md)).

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| Two independent numbers — the plugin versions itself, npm versions the package | Honest about them being different artifacts, but it puts two numbers on one repository, doubles the release ritual, and gives a consumer no way to tell which one the skill they installed came from. |
| `package.json` is the sole source of truth; `plugin.json` is purely derived | Fits changesets, but a plugin that does not ship to npm has no `package.json` to derive from, and every runtime reads a manifest derived from the canonical one ([0007](./0007-adopt-agent-plugins-spec-canonical.md)), not from npm's. §2 keeps the changesets fit without making npm a prerequisite for having a version. |
| Bump the plugin version *after* publish, driven by the published package version | The mechanism this repository had started on. Rejected on ordering: the published tarball would then contain manifests carrying the previous number. Running the sync inside `changeset version`, before publish, costs one script step and leaves nothing to repair. |
| Omit `version` from `plugin.json` and let the runtime key on the commit SHA | Claude Code does resolve a git source's version from its commit when the manifest declares none, which would make every content change visible.[^cc-version] Rejected twice over: the build refuses a Codex target that carries no `version`, and keying on the commit makes every commit a release, which is the opposite of the promise §4 asks a version to carry. |
| Emit a `ref` or `sha` pin in generated catalog entries | Unavailable by construction (§5) and the wrong level — it would freeze every consumer on the ref the author happened to write. |
| Make `plugin build` fail when content changed without a bump | No prior-content state exists to compare against, and the failure would fire throughout normal development (§6). |

## Consequences

- The canonical `plugin.json` `version` is quotable as the plugin's version anywhere, with no "which
  one" qualifier. `.agents/spec/plugin/version/README.md`'s deferred policy question is closed.
- `plugin version` is the one stamp for both release models; §2 selects which version source a
  repository calls, by `packagePath`. (Before #179, `publish sync-version` was the npm-side command;
  it is now a deprecated alias of `plugin version --from-package`.)
- #45 (`init` generating a repository-local `marketplace.json`) and #29 (local Codex marketplace
  metadata) both derive the entry version from the canonical manifest of the plugin the entry's
  source resolves to. Neither introduces an authored version, and neither needs to ask this question
  again.
- Where a runtime lets both the catalog entry and the plugin manifest carry a version, the manifest
  wins — Claude Code documents that it overrides the entry silently.[^cc-version] A generated entry
  is therefore never the number that decides anything on Claude Code, and must never be the number a
  human edits on any runtime.
- `doctor` grows one finding (§6) and one repair pointing at the version move.
- `main` carries released content. A repository that wants a development target adopts tags as a
  convention; nothing in the CLI changes to support it, and nothing prevents it.

[^cc-marketplaces]: Claude Code, *Plugin marketplaces* — plugin source types and their `ref`/`sha`
    fields, and the note that git-based marketplace sources accept `ref` but not `sha`.
    <https://code.claude.com/docs/en/plugin-marketplaces> (verified 2026-08-18).

[^cc-version]: Claude Code, *Plugins reference — version management*: the plugin version is the cache
    key, resolved from `plugin.json` first, the marketplace entry second, and the source's git commit
    third; pushing commits without changing the declared version leaves existing users on the cached
    copy. <https://code.claude.com/docs/en/plugins-reference#version-management> (verified
    2026-08-18).

[^copilot-plugin-ref]: GitHub, *Copilot CLI plugin reference* — `github` and `url` plugin sources
    accept `ref`, and an optional full-length `sha` to pin an exact commit.
    <https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference>
    (verified 2026-08-18).

[^sr-config]: semantic-release 25.0.9 source, `lib/get-config.js`: the config is loaded with
    `cosmiconfig("release").search(cwd)`, and the default `plugins` list is `commit-analyzer`,
    `release-notes-generator`, `npm`, `github`. cosmiconfig 9.0.2 `dist/defaults.js` gives the search
    places, in order: `package.json#release`, `.releaserc` with no extension or
    `.{json,yaml,yml,js,ts,cjs,mjs}`, the same under `.config/releaserc*`, and
    `release.config.{js,ts,cjs,mjs}`. The first one found is the only one read.
    <https://github.com/semantic-release/semantic-release/blob/master/lib/get-config.js> (read
    2026-11-09).

[^sr-npm]: `@semantic-release/npm` 13.2.0 source, `lib/get-pkg.js`: a missing `package.json` throws
    `ENOPKG` from `verifyConditions`. Read 2026-11-09.

[^rp-simple]: release-please 17.11.2 source, `build/src/strategies/simple.js` (the updates are
    `CHANGELOG.md` and `version-file`, default `version.txt`, not created when missing) and
    `build/src/manifest.js` (released versions read from `.release-please-manifest.json`). Read
    2026-11-09.

[^rp-customizing]: release-please, *Customizing releases* — `extra-files` and the `json` updater with
    `jsonpath`. <https://github.com/googleapis/release-please/blob/main/docs/customizing.md>
    (verified 2026-11-09).

[^gh-token-trigger]: GitHub Docs, *Triggering a workflow* — "events triggered by the `GITHUB_TOKEN`
    will not create a new workflow run", except `workflow_dispatch` and `repository_dispatch`; use a
    GitHub App installation access token or a personal access token instead.
    <https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow>
    (verified 2026-11-09).

[^gh-required-checks]: GitHub Docs, *Troubleshooting required status checks* — "if a workflow is
    triggered by `workflow_dispatch` on a pull request's head branch, checks reported by its jobs do
    not appear in the pull request's checks section. Even if the checks pass for the head commit, they
    do not satisfy a required status check", and required checks must pass on the latest commit SHA.
    <https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks>
    (verified 2026-11-09).

[^rp-action-token]: release-please-action README — the `token` input defaults to `GITHUB_TOKEN`,
    resources it creates with that token trigger no workflows, and the workflow needs `contents`,
    `issues` and `pull-requests` write.
    <https://github.com/googleapis/release-please-action#other-actions-on-release-please-prs>
    (verified 2026-11-09).

[^release-it-npm]: release-it, *npm* — `"npm": false` ignores `package.json`, bumps no package
    version, and publishes nothing; the version then comes from the latest git tag.
    <https://github.com/release-it/release-it/blob/main/docs/npm.md> (verified 2026-11-09 against
    release-it 21.1.2: with no tag a release starts from `0.0.0`).

[^release-it-git]: release-it, *Git* — the release commit runs `git add . --update`, so tracked files
    changed by a hook are committed and untracked files are not (`git.addUntrackedFiles`).
    <https://github.com/release-it/release-it/blob/main/docs/git.md> (verified 2026-11-09 by a run
    of release-it 21.1.2 whose `after:bump` hook rewrote `plugin.json`).

[^ri-config]: release-it, *Configuration* — `.release-it.json`, `.ts`, `.js`/`.cjs`, `.yaml`/`.yml`,
    `.toml`, or the `release-it` property in `package.json`; interactive runs prompt for the new
    version. <https://github.com/release-it/release-it/blob/main/docs/configuration.md> and
    <https://github.com/release-it/release-it#readme> (verified 2026-11-09).

[^cursor-plugins-ref]: Cursor, *Plugins reference* — a marketplace entry's `source` is a path within
    the repository; there is no git source type. Refresh tracks the branch the marketplace is
    configured against. <https://cursor.com/docs/reference/plugins> and
    <https://cursor.com/docs/plugins> (verified 2026-08-18).

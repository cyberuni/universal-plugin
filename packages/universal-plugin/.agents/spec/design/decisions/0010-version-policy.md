# 0010 — Version policy: one number, owned by the canonical manifest

**Status:** accepted
**Date:** 2026-08-18
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
| `.claude-plugin/plugin.json`, `.cursor-plugin/plugin.json`, `.codex-plugin/plugin.json`, root copilot manifest | `plugin build` |
| Repository-local marketplace catalogs | `marketplace init` |
| `npx`/`upx <cli>@<version>` pins inside `skills/**` | `plugin bundle` |

"Owns" is about the value every artifact reads, not about who chooses it. Choosing is §2.

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
- `plugin version` and `publish sync-version` are not two ways to do one thing; §2 makes them the two
  release models, selected by `packagePath`. Neither gains a flag to override the other.
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

[^cursor-plugins-ref]: Cursor, *Plugins reference* — a marketplace entry's `source` is a path within
    the repository; there is no git source type. Refresh tracks the branch the marketplace is
    configured against. <https://cursor.com/docs/reference/plugins> and
    <https://cursor.com/docs/plugins> (verified 2026-08-18).

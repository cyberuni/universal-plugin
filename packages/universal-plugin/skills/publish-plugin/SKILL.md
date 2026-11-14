---
name: publish-plugin
description: Use this skill whenever the user wants to publish, release, submit, or share a plugin to the universal plugin marketplace so it works across Claude Code, Cursor, Codex, and GitHub Copilot CLI — a first listing or a new version of one already listed, which are the same request. Trigger on phrases like "publish my plugin", "publish the new version", "release to the marketplace", "submit to marketplace", "release plugin", "update the marketplace listing", "list my plugin", "share my plugin", or any mention of getting a plugin into the universal registry. Works whether the current repo is the plugin being published or the marketplace it is going into. The plugin should already be packaged before using this skill.
---

# Publish Universal Plugin

Puts the plugin's current version into a marketplace, the way `npm publish` puts the version in `package.json` into the registry. One flow covers every case: a plugin the marketplace does not list is added, one listed at an older version is moved to this release in place, and one already listed at this version is left alone. The change goes in as a pull request, or, for a curated marketplace that takes no pull requests, as a drafted submission. Each vendor runtime may have its own catalog file inside the marketplace repo — update every one that exists.

Publishing a new version is not a separate "update" request. Do not wait to be told "update"; read the listing and decide.

**Target marketplace repo:** resolved in Step 0a: the one the user names, else the plugin's
`marketplaces` config, else the fallback `cyber-uni/marketplace`.

Listing a plugin in a shared repository is not the only way to distribute it. A repository can carry
its own catalog and let users add it directly as a marketplace. That is the `marketplace` skill; the
two compose, and neither replaces the other.

## Overview

Publishing has four steps:

0. **Locate** — work out which repo is which, where the plugin and the marketplace each live, and whether the marketplace takes PRs at all
1. **Pre-flight** — validate the plugin is ready, and resolve the release its version points at; stop if that release does not exist
2. **Prepare entries** — for each target marketplace, read how it lists the plugin and decide: add, update in place, or nothing to do; then build the change for every catalog it carries, and resolve the plugin's dependencies against it
3. **Submit PR** — one PR per target marketplace that updates all of its catalogs

Work through each step in order. Do not skip pre-flight even if the user says the plugin is ready.

Steps 0b–3 run once per target marketplace that 0a resolves. Each target gets its own decision in
2b, because one can list the plugin while another does not.

---

## Step 0: Locate the plugin and the marketplace

Two repos are in play — the plugin being published and the marketplace it is going into — and the
current working directory could be either one. Do not assume it is the plugin repo just because that
is the common case.

### 0a. Identify the marketplace repo

Resolve the target in this order. The first rule that yields a target wins:

1. **Named in the request.** The user names a repository (`<owner>/<repo>`), or the `name` of an
   entry in the plugin's `marketplaces` config. A configured name resolves to that entry's `repo`.
   A name that is neither a repository nor a configured entry is ambiguous: ask, do not guess an
   owner. For example, "to cyber-uni" with no configured entry of that name is not a repository.
2. **The plugin's config.** Read the `marketplaces` key from the **plugin's** root (the directory
   holding its `plugin.json` and `.agents/`), through the CLI rather than by reading the file:

   ```bash
   npx universal-plugin config get --key marketplaces --format json --root <plugin-root>
   ```

   Each entry is `{ "name": "<label>", "repo": "<owner>/<repo>" }`. With one entry, publish to it.
   With several, publish to every one, one PR each, running Steps 0b to 3 once per target. Skip an
   entry with no `repo`, or a `repo` not in `<owner>/<repo>` form, and tell the user which one.
   `[]` means nothing is configured.
3. **Fallback:** `cyber-uni/marketplace`.

Before any other step, tell the user each target and the rule that picked it, for example
"`cyber-uni/marketplace`, from `.agents/universal-plugin.json` (entry `cyber-uni`)" or
"`cyber-uni/marketplace`, fallback default". A wrong target is cheap to fix here and costly after a PR
opens.

When the user wants the target remembered for this plugin, record it with
`npx universal-plugin config add --key marketplaces --entry '{"name":"<label>","repo":"<owner>/<repo>"}' --root <plugin-root>`.
Re-adding a `name` replaces that entry.

The commands below call one target `<marketplace-repo>` (`<owner>/<repo>`), and its repository name
`<marketplace-repo-name>`.

When the cwd is the marketplace and the user names no plugin, rule 2 has no plugin root to read
yet. Run 0b first, then read the plugin's config once its location is known.

### 0b. Identify which repo the cwd is

```bash
gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null
```

Compare the result against the marketplace repo from 0a.

- **Matches the marketplace repo** → cwd *is* the marketplace. The plugin lives elsewhere: ask the
  user for its location if they have not given one — a local path, or a git URL to clone. Resolve a
  git URL with `gh repo clone <url> /tmp/<plugin-name>` (or a scratch directory) so pre-flight has a
  checkout to read; do not guess metadata from the URL alone.
- **Does not match, or `gh repo view` fails** (no `origin`, not a GitHub repo, detached checkout) →
  cwd is the plugin repo. This is the default path described in Steps 1–3 below.
- **User states their role explicitly** ("I'm already in the marketplace repo", "publish the plugin
  at ../foo") — trust that over the remote check; it exists to catch the unstated case, not to
  override what the user already told you.

Name two locations going forward and keep them distinct in your own reasoning and in what you tell
the user:

- **plugin location** — the directory holding the plugin's root `plugin.json`, wherever it is
- **marketplace location** — the directory holding the marketplace's vendor catalog files

Every pre-flight check and entry field in Steps 1–2 reads from the plugin location, not the cwd.
Step 3 branches on whether the marketplace location is already the cwd.

### 0c. Check how the marketplace takes submissions

Some marketplaces are curated directories that do not take plugins by pull request, for example
`anthropics/claude-plugins-official`. Check the target live every time; do not rely on what you
remember about a catalog, because its rules change.

```bash
gh repo view <marketplace-repo> --json viewerPermission -q .viewerPermission
```

If the result is `READ` (no write access):

1. List the target's `.github/workflows/` and read any workflow that closes pull requests from
   outsiders. Note what it lets through, if anything.
2. Read the README's Contributing section (or `CONTRIBUTING.md`) for the submission route.

If submission is form-only, or a workflow closes outside pull requests automatically, **do not open
a PR**. Switch to drafting the submission:

- Run Step 1's pre-flight as usual.
- Resolve dependencies (2g) against the target's **live** catalog, read from its default branch. A
  plain dependency the catalog does not list cannot be added through a form, so tell the user it
  will not resolve there.
- Write the entry in the shape the catalog's existing entries use, not the shape in 2d. For example,
  when existing entries pin `git-subdir` sources with `ref` and `sha`, use the plugin's release tag
  and that tag's commit.
- When the catalog already lists the plugin, run 2b against the live catalog too: at this version,
  report it and stop; at an older version, draft the changed pins and fields instead of a new entry.
- Hand the user the drafted entry and the submission link the target names. Skip Step 3.

Otherwise (write access, or a fork-and-PR route the target accepts), continue to Step 1.

---

## Step 1: Pre-flight validation

Run these checks against the **plugin location** from Step 0. Stop and fix any failures before continuing.

### 1a. Required metadata

Read the plugin's root `plugin.json`. Verify:

- `name` — present, kebab-case (no spaces, no uppercase)
- `version` — present, valid semver (`x.y.z`)
- `description` — present, at least 10 characters
- `author` — present (string or `{name, email}` object)
- `homepage` or `repository` — at least one present
- `license` — present (SPDX identifier, e.g. `MIT`, `Apache-2.0`)

### 1b. Vendor manifest files

Each runtime expects its manifest at a specific path. Check all targeted runtimes and verify each has at minimum a `name` field:

| Runtime | Expected path |
|---|---|
| Claude Code | `.claude-plugin/plugin.json` |
| Cursor | `.cursor-plugin/plugin.json` |
| Codex | `.codex-plugin/plugin.json` |
| GitHub Copilot CLI | `plugin.json` (root) |

See `references/vendor-requirements.md` for required fields and hook casing rules per vendor.

### 1c. Hook casing check

`plugin build` owns hook casing: the canonical file is authored in PascalCase, and Cursor's
`.cursor-plugin/hooks.json` is derived from it. Verify the build ran rather than hand-checking the
casing, and read its warnings — a handler type the vendor cannot run is dropped, so a hook can be
absent from a vendor's file by design.

### 1d. Skills check (if present)

If the plugin ships skills, each `skills/<name>/SKILL.md` must exist with valid YAML frontmatter containing at minimum `name` and `description`.

### 1e. Resolve the release

The version in `plugin.json` (1a) is what gets published. Resolve the release it points at before
touching any catalog, because an entry pinned to a release that does not exist installs nothing.

- **Git-distributed plugin** (any source type except `npm`, see 2c) — find the release tag. Monorepo
  release tools tag `<name>@<version>` (changesets, release-please); a single-package repository
  usually tags `v<version>`. The tag an existing entry pins (`source.ref`) shows which convention
  the plugin uses. List the remote's tags rather than the local ones, since a tag that was never
  pushed cannot be installed:

  ```bash
  git ls-remote --tags <git-clone-url> '<name>@<version>' 'v<version>'
  ```

  Record the tag and the commit it points at: the `^{}` line for an annotated tag, otherwise the
  tag's own line. That commit is the `sha` a pinned entry takes.
- **npm-distributed plugin** — confirm the version is on the registry:

  ```bash
  npm view <npm-package-name>@<version> version
  ```

**If the release does not exist, stop.** Tell the user which tag or npm version is missing and that
the plugin's version has to be released first (the `version` skill and the repository's release
flow), then pushed. Do not pin a ref that does not exist, do not fall back to the default branch, and
do not open the PR.

### 1f. Report

List what passed and what failed, and the release resolved in 1e. Do not proceed to Step 2 until all
checks pass.

---

## Step 2: Prepare marketplace entries

### 2a. Detect which vendor marketplace files exist

Get the **marketplace location** locally if it is not already the cwd — see Step 3a, which this step
can run ahead of when you need the files present before drafting entries. Then look for vendor
marketplace files:

| File | Runtime |
|---|---|
| `.claude-plugin/marketplace.json` | Claude Code |
| `.cursor-plugin/marketplace.json` | Cursor |
| `.agents/plugins/marketplace.json` | Codex |
| `.github/plugin/marketplace.json` | GitHub Copilot CLI |

Only prepare entries for files that actually exist — do not create new vendor marketplace files.

### 2b. Decide: add, update, or nothing

Look the plugin up by `name` in each catalog from 2a, and read the version each listing is at:

1. the entry's `version` field, when it has one;
2. otherwise the version its pinned `source.ref` tag names (`<name>@1.2.0`, `v1.2.0`);
3. otherwise the npm source's `version`.

Compare it with the version resolved in 1e, catalog by catalog:

| The catalog | Do |
|---|---|
| Does not list the plugin | **Add** it: 2c–2e build the entry. |
| Lists it at an older version | **Update** it in place: 2f. |
| Lists it at this version, pinned to this release | **Nothing.** The catalog already says this. |
| Lists it at a newer version | **Stop.** Publishing never moves a listing back; tell the user. |
| Lists it with no version and no pin | It follows the default branch. Ask the user whether to pin it to this release; pinning changes how the listing tracks the plugin. |

When every catalog lands on **Nothing**, report that this version is already published there,
naming the version and the catalogs that list it, and stop for this marketplace: no branch, no
commit, no PR. This is `npm publish` refusing to republish a version, and it is a result, not an
error.

Catalogs of one marketplace can disagree, for example the Claude catalog at an older version and the
Cursor catalog without the plugin. Act per catalog and put all of it in the one PR. A catalog that
does not list the plugin may leave it out on purpose, because its runtime cannot install the
source; `marketplace add` skips such a catalog and says why, so report that rather than forcing the
entry in.

### 2c. Determine the source/distribution type

Before writing any entry, decide how the plugin is actually distributed — do not default to a
root-clone `url`. Read the signals from the plugin's own repository, in this order:

1. **`npm`** — the CLI reports a `packagePath`, and `<packagePath>/package.json` is not
   `"private": true`. The plugin ships as an npm package. Ask the CLI rather than reading
   `.agents/universal-plugin.json` or `package.json` yourself; the path it prints is relative to the
   plugin root:

   ```bash
   npx universal-plugin config get --key packagePath --infer --format json --root <plugin-root>
   ```

   `--infer` also answers when no `packagePath` is declared: it prints `"."` when the plugin root's
   own `package.json` is public and its `files` publish `plugin.json`. `null` means the plugin does
   not ship through npm. When the path was inferred (the command's stderr says to declare it), tell
   the user that `.agents/universal-plugin.json` lacks `"packagePath": "."`, so `doctor` and the
   version check miss the package, and offer to add it in the plugin's repository. Then confirm the
   package really carries the manifest at this version:

   ```bash
   npm view <npm-package-name>@<version> version
   npm pack <plugin-root>/<packagePath> --dry-run --json
   ```

   The `files` list `npm pack` prints must hold a `plugin.json` path. If it does not, the plugin is not npm-distributed after all;
   fall through to the next signal.

   **Copilot CLI and Cursor cannot install an npm source**, so `marketplace add` leaves the plugin
   out of those two catalogs and says so. List it there from git instead, with the source the next
   two signals pick (`git-subdir` for a plugin below the repository root). The Claude Code and Codex
   entries keep the `npm` source.
2. **`git-subdir`** — the plugin's `plugin.json` (or its vendor manifests) live below the
   repository root, e.g. `packages/<name>/plugin.json`, and there is no `packagePath`/npm
   distribution, or the target is the Copilot CLI or Cursor catalog of an npm plugin. This is the
   common monorepo case: the repository root holds no plugin manifest at
   all, only a `marketplace.json` catalog or unrelated packages, so a root-clone `url` source
   resolves nothing.
3. **`url` / `github`** — `plugin.json` sits at the repository root. `url` for a plain clone,
   `github` when a sparse/shallow checkout is preferred.

Only ask the user when these signals genuinely conflict or are missing (e.g. no `plugin.json` found
at any candidate path). Otherwise decide from the signals and state which one you picked and why.

### 2d. Claude Code entry (`.claude-plugin/marketplace.json`)

The richer format. Use this shape, filling `source` per the type decided in 2c:

```json
{
  "name": "<plugin-name>",
  "source": { "source": "url", "url": "<git-clone-url>.git" },
  "description": "<one-line description>",
  "author": { "name": "<author>" },
  "homepage": "<URL>",
  "repository": "<git-clone-url>",
  "license": "<SPDX identifier>",
  "category": "<category>"
}
```

**`<git-clone-url>`** — the plugin's own repo URL, read from the **plugin location** (`gh repo view --json url -q .url`, or the `repository` field in its `plugin.json`) — never the marketplace repo's URL.

**`source` shapes** — pick the one matching 2c's decision:

| Type | Shape | When |
|---|---|---|
| `url` | `{ "source": "url", "url": "<git-clone-url>.git" }` | `plugin.json` at repo root |
| `github` | `{ "source": "github", "repo": "<owner>/<repo>" }` | repo root, sparse checkout |
| `git-subdir` | `{ "source": "git-subdir", "url": "<git-clone-url>.git", "path": "<repo-relative-path-to-plugin-dir>" }` | plugin lives in a monorepo subdirectory, e.g. `packages/<name>` |
| `npm` | `{ "source": "npm", "package": "<npm-package-name>" }` | plugin ships as an npm package (`packagePath` present, not private) |
| `file` / `directory` | see the marketplace schema | local-only entries |

**`category`** — choose closest: `research`, `skills`, `setup`, `productivity`, `plugin-authoring`.

**`skills`** — if the plugin ships skills users invoke directly, list their relative paths:
```json
"skills": ["./skills/my-skill"]
```

**`strict`** — set `false` unless the plugin requires exact version pinning.

Omit optional fields rather than leaving them empty.

### 2e. Cursor entry (`.cursor-plugin/marketplace.json`)

The simpler format — only three required fields:

```json
{
  "name": "<plugin-name>",
  "source": { "source": "url", "url": "<git-clone-url>.git" },
  "description": "<one-line description>"
}
```

The `source` field supports the git and local shapes of Claude Code (`url`, `github`, `git-subdir`,
`file`, `directory`), but not `npm`. Pick per 2c; for an npm plugin, use its git source here.

### 2f. Update an entry listed at an older version

For each catalog 2b marked **Update**, move the listing to the release from 1e in place with
`marketplace update`, run in the marketplace checkout. Do not rebuild the entry from 2d/2e and do not
edit the catalogs by hand: `update` keeps every field it is not given, curator fields included, and
validates each catalog before writing.

Pass what the release changes:

- **The pin.** A git source pinned with `ref` moves to the new tag: `--ref <tag>`. When the entry
  also pins `sha`, pass `--sha <commit>` with the tag's commit from 1e; `--ref` alone would keep the
  old sha, which names a commit the new tag has moved past.
- **The version.** `--version <version>` when the entry carries `version`, or when its npm source
  is pinned to one.
- **Changed fields.** Compare `description`, `homepage`, `repository`, `license`, and `keywords`
  with the plugin's `plugin.json`, and pass each that differs. Leave `category` and any field a
  curator set alone.

```bash
npx universal-plugin marketplace update <plugin-name> --ref <tag> --sha <commit> --version <version> --dry-run --root .
```

With no catalog flag it plans every catalog, so a `skipped` row for one that does not list the plugin
is expected; report each skip with its reason. Drop `--dry-run` once the plan reads right. If the
entry carries `publishedAt`, keep it and set `"updatedAt": "<today>"` by hand, since `update` has no
flag for it.

Show all prepared changes, adds and updates, to the user and ask them to confirm before proceeding.

### 2g. Resolve the plugin's dependencies

Claude Code installs a plugin only when every dependency it declares resolves, so a catalog that lists
the plugin but not what it depends on publishes a plugin nobody can install. Read the declaration
Claude Code receives, from the **plugin location**: `dependencies` in `.claude-plugin/plugin.json`
(the built manifest), or, if that has not been built, the canonical one —
`extensions["org.cyberuni.universal-plugin"].harnesses["claude-code"].dependencies`, else
`extensions["org.cyberuni.universal-plugin"].dependencies` in `plugin.json`. No declaration means
nothing to do here.

Each entry is a string (`<plugin>` or `<plugin>@<marketplace>`, optionally with an `@^range` tail) or
an object (`{ "name", "marketplace"?, "version"?, ... }`). Sort each one:

- **Plain** — a bare `<plugin>`, or an object with no `marketplace`. Claude Code resolves it against
  the marketplace the plugin is installed from, which is this one. If the target catalog
  (`.claude-plugin/marketplace.json`) already lists that name, it is resolved. Otherwise it must be
  listed in this same PR: locate the dependency's own repository or package (an object's `source`
  field, when present, says where it is distributed from; otherwise ask the user), run Step 1's
  pre-flight against it, and prepare its entries exactly as 2b–2f do for the main plugin — then
  resolve *its* plain dependencies the same way. If a plain dependency cannot be listed (no
  repository or package to read, pre-flight fails, the user declines), **stop**: tell the user to
  publish that dependency to this marketplace first, and do not open the PR.
- **Names a marketplace** — `<plugin>@<marketplace>`, or an object with `marketplace`. Not held to
  this catalog's listing, even when the marketplace it names is this one; do not add an entry for
  it. When the named marketplace is **not** this catalog's `name`, Claude Code refuses the
  dependency at install unless this catalog's top-level `allowCrossMarketplaceDependenciesOn` lists
  that marketplace. If it does not, tell the user that installs from this marketplace need it, and
  offer to add the marketplace name to that array in the same PR.

Report how each dependency was sorted and what was done about it, and include the dependency entries
in what you show the user to confirm.

### 2h. Validate the catalogs

Before moving to Step 3, run the validator against the marketplace repo's working copy (the same
checkout the entries were just written into):

```bash
npx universal-plugin marketplace validate --root .
```

This is the same check `marketplace init`/`build` rely on — it catches an entry shape no runtime can
load (a bad `source`, a missing required key) before it reaches a PR. In the Claude catalog it also
reports a plain dependency the catalog does not list and a dependency on a marketplace missing from
`allowCrossMarketplaceDependenciesOn`, as far as it can see them offline (an entry's own
`dependencies`, and plugins at `./` paths) — so it does not replace 2g for a plugin listed from npm
or git. Fix any reported issue and
re-run before continuing. Do not open the PR while validation fails.

---

## Step 3: Submit PR

Use the `gh` CLI. Confirm commands that affect shared state before running.

### 3a. Get the marketplace repo locally

Skip this whole step when Step 0 already found the cwd to be the marketplace location — work
directly in it, but bring it up to date first:

```bash
git fetch origin && git merge origin/main
```

Otherwise, the marketplace repo is elsewhere and needs a working copy. If the user has write access
(org member), work directly:

```bash
gh repo clone <marketplace-repo>
cd <marketplace-repo-name>
```

If a fork is needed:

```bash
gh repo fork <marketplace-repo> --clone --remote
cd <marketplace-repo-name>
git fetch upstream && git merge upstream/main
```

From here on, "the marketplace repo" means whichever of these is now the working directory —
including the original cwd, when Step 0 found it already was the marketplace.

### 3b. Create a branch

Name the branch after what 2b decided, so a reviewer can tell an add from a version move:

```bash
git checkout -b add-<plugin-name>        # not listed in any catalog
git checkout -b publish-<plugin-name>-<version>   # listed, moving to this version
```

### 3c. Edit all detected marketplace files

Make every change 2b decided, in every catalog from 2a, on this one branch:

- **Add** — append the plugin entry, and the entry of each dependency 2g listed, to the catalog's
  `plugins` array. `marketplace add` writes every catalog it can, the Codex and Copilot ones
  included, in the shape each runtime loads; prefer it over hand-editing those two. For an npm
  plugin, run it twice: once with the npm spec for Claude Code and Codex, then with the git spec
  for the two catalogs that cannot install npm:

  ```bash
  npx universal-plugin marketplace add npm:<npm-package-name> --claude --codex --root .
  npx universal-plugin marketplace add <owner>/<repo> --subdir <repo-relative-plugin-dir> --ref <tag> --copilot --cursor --root .
  ```
- **Update** — run the `marketplace update` from 2f without `--dry-run`.

Add any `allowCrossMarketplaceDependenciesOn` change the user accepted in 2g. Preserve formatting and
all existing entries exactly. Stage all changed files together.

### 3d. Commit and push

```bash
git add .claude-plugin/marketplace.json .cursor-plugin/marketplace.json .agents/plugins/marketplace.json .github/plugin/marketplace.json  # whichever changed
git commit -m "feat: add <plugin-name> v<version>"        # or: feat: publish <plugin-name> v<version>
git push origin <branch>
```

### 3e. Open the PR

Title an add `Add <plugin-name> v<version>` and a version move `Publish <plugin-name> v<version>`,
and in the body say which catalogs were added to and which were moved from which version.

```bash
gh pr create \
  --repo <marketplace-repo> \
  --title "Add <plugin-name> v<version>" \
  --body "$(cat <<'EOF'
## Plugin

**Name:** <plugin-name>
**Version:** <version>
**Author:** <author>
**License:** <license>
**Category:** <category>

## Description

<description>

## Runtimes

- [x] Claude Code
- [x] Cursor
- [ ] Codex  (no marketplace file)
- [ ] GitHub Copilot CLI  (no marketplace file)

## Marketplace files changed

- `.claude-plugin/marketplace.json` — added | moved from v<old-version>
- `.cursor-plugin/marketplace.json` — added | moved from v<old-version>

## Links

- Homepage: <homepage>
- Repository: <repository>

## Checklist

- [ ] All targeted vendor manifests present and valid
- [ ] `plugin build` ran, and its dropped-handler warnings were read
- [ ] Semver version string
- [ ] Release `<tag>` (or npm version) exists, and every pin names it
- [ ] SPDX license identifier
- [ ] Entry added or moved to this version in each detected marketplace file
- [ ] Every plain dependency is listed in this marketplace (here or already)
- [ ] Every marketplace a dependency names is in `allowCrossMarketplaceDependenciesOn`, or noted as not needed
EOF
)"
```

Return the PR URL to the user when done.

---

## Common failure modes

| Problem | Fix |
|---|---|
| Hook events silently don't fire | Re-run `plugin build`; check its warnings for a handler type that vendor cannot run |
| Codex rejects manifest | `version` and `description` are required by Codex |
| PR rejected: missing source link | Add `homepage` or `repository` to plugin.json |
| Name conflict in marketplace | Check existing entries in each marketplace file first |
| Entry installs nothing after a release | The pin names a tag that was never pushed — 1e was skipped; release and push the tag first |
| A second listing of the same plugin appeared | It was added instead of updated — 2b was skipped; remove the duplicate and move the existing entry with `marketplace update` |
| Nothing to publish | 2b found every catalog at this version already; bump and release the plugin first if a new version was intended |
| Plugin loads but skills missing | Add `skills` array to the Claude Code marketplace entry |
| Entry installs nothing for a monorepo plugin | `source` was `url`/root-clone instead of `git-subdir` — redo 2c/2d with the plugin's actual repo-relative path |
| Install fails resolving a dependency | 2g was skipped — list the plain dependency in this marketplace, or allow the named marketplace in `allowCrossMarketplaceDependenciesOn` |
| `marketplace validate` fails after 2h | Fix the reported shape before opening the PR — do not open it while validation fails |
| PR closed automatically as soon as it opened | The target is curated — redo 0c and use its submission route instead of a PR |
| Entry's `repository`/`source.url` points at the marketplace repo | Step 0 role detection was skipped or overridden wrongly — re-check which repo the cwd is |

---

## Reference files

- `references/vendor-requirements.md` — required fields and hook casing rules per runtime

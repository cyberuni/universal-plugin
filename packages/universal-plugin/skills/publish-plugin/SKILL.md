---
name: publish-plugin
description: Use this skill whenever the user wants to publish, release, submit, or share a plugin to the universal plugin marketplace so it works across Claude Code, Cursor, Codex, and GitHub Copilot CLI. Trigger on phrases like "publish my plugin", "submit to marketplace", "release plugin", "list my plugin", "share my plugin", or any mention of getting a plugin into the universal registry. Works whether the current repo is the plugin being published or the marketplace it is going into. The plugin should already be packaged before using this skill.
---

# Publish Universal Plugin

Guides adding an already-packaged plugin to a marketplace repo by opening a pull request. Each vendor runtime may have its own marketplace manifest file inside the marketplace repo — update every one that exists.

**Default marketplace repo:** `cyberuni/marketplace` (adjust if the user targets a different one)

Listing a plugin in a shared repository is not the only way to distribute it. A repository can carry
its own catalog and let users add it directly as a marketplace. That is the `marketplace` skill; the
two compose, and neither replaces the other.

## Overview

Publishing has four steps:

0. **Locate** — work out which repo is which, and where the plugin and the marketplace each live
1. **Pre-flight** — validate the plugin is ready
2. **Prepare entries** — build the entry for each vendor marketplace file that exists
3. **Submit PR** — one PR that updates all relevant marketplace files

Work through each step in order. Do not skip pre-flight even if the user says the plugin is ready.

---

## Step 0: Locate the plugin and the marketplace

Two repos are in play — the plugin being published and the marketplace it is going into — and the
current working directory could be either one. Do not assume it is the plugin repo just because that
is the common case.

### 0a. Identify the marketplace repo

Default to `cyberuni/marketplace` unless the user names another one.

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

### 1e. Report

List what passed and what failed. Do not proceed to Step 2 until all checks pass.

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

Only prepare entries for files that actually exist — do not create new vendor marketplace files.

### 2b. Determine the source/distribution type

Before writing any entry, decide how the plugin is actually distributed — do not default to a
root-clone `url`. Read the signals from the plugin's own repository, in this order:

1. **`npm`** — `.agents/universal-plugin.json` carries a `packagePath`, and
   `<packagePath>/package.json` is not `"private": true`. The plugin ships as an npm package.
2. **`git-subdir`** — the plugin's `plugin.json` (or its vendor manifests) live below the
   repository root, e.g. `packages/<name>/plugin.json`, and there is no `packagePath`/npm
   distribution. This is the common monorepo case: the repository root holds no plugin manifest at
   all, only a `marketplace.json` catalog or unrelated packages, so a root-clone `url` source
   resolves nothing.
3. **`url` / `github`** — `plugin.json` sits at the repository root. `url` for a plain clone,
   `github` when a sparse/shallow checkout is preferred.

Only ask the user when these signals genuinely conflict or are missing (e.g. no `plugin.json` found
at any candidate path). Otherwise decide from the signals and state which one you picked and why.

### 2c. Claude Code entry (`.claude-plugin/marketplace.json`)

The richer format. Use this shape, filling `source` per the type decided in 2b:

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

**`source` shapes** — pick the one matching 2b's decision:

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

### 2d. Cursor entry (`.cursor-plugin/marketplace.json`)

The simpler format — only three required fields:

```json
{
  "name": "<plugin-name>",
  "source": { "source": "url", "url": "<git-clone-url>.git" },
  "description": "<one-line description>"
}
```

The `source` field supports the same shapes as Claude Code (`url`, `github`, `git-subdir`, `npm`,
`file`, `directory`) — pick per 2b, same as the Claude Code entry.

### 2e. Update scenario

If the plugin is already listed (this is an update), find its existing entry, update changed fields, and preserve any curator-added fields not in the standard shape. Do not overwrite `publishedAt` if present — add `"updatedAt": "<today>"` instead.

Show all prepared entries to the user and ask them to confirm before proceeding.

### 2f. Validate the catalogs

Before moving to Step 3, run the validator against the marketplace repo's working copy (the same
checkout the entries were just written into):

```bash
npx universal-plugin marketplace validate --root .
```

This is the same check `marketplace init`/`build` rely on — it catches an entry shape no runtime can
load (a bad `source`, a missing required key) before it reaches a PR. Fix any reported issue and
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
gh repo clone cyberuni/marketplace
cd marketplace
```

If a fork is needed:

```bash
gh repo fork cyberuni/marketplace --clone --remote
cd marketplace
git fetch upstream && git merge upstream/main
```

From here on, "the marketplace repo" means whichever of these is now the working directory —
including the original cwd, when Step 0 found it already was the marketplace.

### 3b. Create a branch

```bash
git checkout -b add-<plugin-name>
```

### 3c. Edit all detected marketplace files

For each vendor marketplace file detected in Step 2a, append the plugin entry to its `plugins` array. Preserve formatting and all existing entries exactly. Stage all changed files together.

### 3d. Commit and push

```bash
git add .claude-plugin/marketplace.json .cursor-plugin/marketplace.json  # whichever exist
git commit -m "feat: add <plugin-name> v<version>"
git push origin add-<plugin-name>
```

### 3e. Open the PR

```bash
gh pr create \
  --repo cyberuni/marketplace \
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

## Marketplace files updated

- `.claude-plugin/marketplace.json`
- `.cursor-plugin/marketplace.json`

## Links

- Homepage: <homepage>
- Repository: <repository>

## Checklist

- [ ] All targeted vendor manifests present and valid
- [ ] `plugin build` ran, and its dropped-handler warnings were read
- [ ] Semver version string
- [ ] SPDX license identifier
- [ ] Entry appended to each detected marketplace file
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
| Plugin loads but skills missing | Add `skills` array to the Claude Code marketplace entry |
| Entry installs nothing for a monorepo plugin | `source` was `url`/root-clone instead of `git-subdir` — redo 2b/2c with the plugin's actual repo-relative path |
| `marketplace validate` fails after 2f | Fix the reported shape before opening the PR — do not open it while validation fails |
| Entry's `repository`/`source.url` points at the marketplace repo | Step 0 role detection was skipped or overridden wrongly — re-check which repo the cwd is |

---

## Reference files

- `references/vendor-requirements.md` — required fields and hook casing rules per runtime

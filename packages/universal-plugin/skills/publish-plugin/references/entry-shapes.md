# Marketplace entry shapes

Read this when Step 2b decides to **Add** an entry, or a curated submission needs one drafted. Fill
`source` with the type Step 2c decided.

## Claude Code entry

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

**`category`** — choose the closest one the catalog's existing entries use.

**`skills`** — if the plugin ships skills users invoke directly, list their relative paths:
```json
"skills": ["./skills/my-skill"]
```

**`strict`** — set `false` unless the plugin requires exact version pinning.

Omit optional fields rather than leaving them empty.

## Cursor entry

```json
{
  "name": "<plugin-name>",
  "source": { "source": "url", "url": "<git-clone-url>.git" },
  "description": "<one-line description>"
}
```

The `source` field supports the git and local shapes of Claude Code (`url`, `github`, `git-subdir`,
`file`, `directory`), but not `npm`. Pick per 2c; for an npm plugin, use its git source here.


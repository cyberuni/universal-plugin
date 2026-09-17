# Route: add

List a plugin that lives somewhere else — an npm package, a GitHub repository, or an entry another
marketplace already publishes. This is what makes a repository a curated marketplace rather than
only its own plugins' home.

`init` covers the other case and the two compose; see `references/init.md`.

## 1. Work out what the user is naming

One positional argument says where the plugin lives. The command disambiguates by shape:

| Form | Example | Source written |
| --- | --- | --- |
| path in this repository | `./plugins/alpha` | `"./plugins/alpha"` |
| GitHub repository | `cyberuni/universal-plugin` | `{ "source": "github", "repo": "…" }` |
| git or https URL | `https://example.com/o/r.git` | `{ "source": "url", "url": "…" }` |
| npm package | `npm:repobuddy`, `@cyberuni/upx` | `{ "source": "npm", "package": "…" }` |
| another marketplace | `repobuddy@cyberplace` | whatever source that marketplace publishes |

Two shapes collide, and both have a flag that settles them:

- **`plugins/alpha` reads as a GitHub repository**, not a directory — `owner/repo` and a relative
  path are the same string. Write `./plugins/alpha`, or pass `--path`.
- **A leading `@` is a scope, not a marketplace.** `@cyberuni/upx` is a package; `upx@cyberplace` is
  a marketplace entry.

`--path`, `--npm`, `--github`, `--url`, and `--from-marketplace` each force the reading. Pass one.

## 2. Choose targets, and know what will be skipped

Not every runtime installs from every source. Only a repository path reaches all four:

| Source | Claude Code | Codex | Copilot CLI | Cursor |
| --- | --- | --- | --- | --- |
| path | yes | yes | yes | yes |
| npm | yes | yes | — | — |
| github, url, git-subdir | yes | — | — | — |

A target that cannot resolve the source is reported `skipped` with the reason, and no file is
written for it. That is deliberate: a source a runtime refuses is an install failure in someone
else's terminal. Say which targets were skipped and why — do not report "added" and leave the user
to discover that two catalogs have no entry.

With no target flags all four are selected, so the skips are the normal case for an npm package.

## 3. Supply the metadata

Nothing is fetched. The command reads what is already on this machine and takes the rest from flags:

- a **path** source reads the plugin's own `plugin.json`
- an **npm** source reads `node_modules/<pkg>/package.json` when the package happens to be installed
- a **marketplace** entry brings the metadata that marketplace already publishes

Flags fill or override the gaps: `--description`, `--version`, `--homepage`, `--repository`,
`--license`, `--keywords` (comma-separated). Ask the user for a description at minimum; an entry
with only a name tells a browsing user nothing.

`--name` overrides the entry name, which otherwise comes from the spec: the package name without its
scope, the repository name, or the directory name.

## 4. Preview, then write

```bash
node scripts/add.mjs npm:repobuddy --description "Repo automation" --dry-run
```

Resolve that path against this skill's own directory; `npx universal-plugin marketplace add` is the
fallback. Run `--dry-run` first and show the plan, including the skips. The command never prompts.

| Status | Means |
| --- | --- |
| `added` | the entry was not listed; it is now |
| `updated` | an entry of that name was listed and has been replaced |
| `unchanged` | already says exactly this |
| `planned` | `--dry-run` only |
| `skipped` | that runtime cannot resolve this source; the reason says which |

An entry already listed **differently** stops the run and asks for `--force`. Read what would change
before passing it: someone wrote that entry, and `--force` is what discards their version.

The catalog is created if the repository has none, named and owned the same way `init` names it —
from the root `plugin.json` author, with `--marketplace-name` and `--owner` to override. A
repository curating other people's plugins usually has no root manifest, so `--owner` is the flag it
needs.

## 5. Resolving `<plugin>@<marketplace>`

The catalog schema has no "from another marketplace" source, so the entry is **resolved and copied**
rather than referenced. The marketplace has to be readable:

- installed in the runtime already — read from `~/.claude/plugins`, no network
- otherwise, `--from <dir>` naming a checkout of it

A marketplace that is not installed stops the run and says so. Ask the user to add it in their
runtime, or to point `--from` at a clone; do not guess a URL.

An entry whose source is a `./` path **cannot** be copied: it resolves against that marketplace's
root, which this repository is not. The command refuses it rather than writing a path that does not
exist here.

## 6. Validate

Follow `references/validate.md`. The entry has to load in every runtime that got one.

Then state plainly that nothing was published: the entry sits in the repository until a user adds it
as a marketplace.

---
name: marketplace
description: Use this skill to let people install a plugin straight from its own repository — generate the local marketplace catalogs Claude Code, Codex, GitHub Copilot CLI, and Cursor read, and write the README install section that tells users what to type. Trigger on "set up a local marketplace", "let users install this from my repo", "generate marketplace catalogs", "add install instructions to the README", "how do people install this plugin", or "make this repo installable".
argument-hint: '[--claude] [--codex] [--copilot] [--cursor] [--dry-run] [--force]'
---

# Local marketplace

A repository can carry its own catalog, so a user adds the repository as a marketplace and installs
from it. No service, no submission, no account.

All four runtimes read such a catalog. Three of them let a user add it; Cursor's reaches users when
an admin imports the repository as a team marketplace.

| Runtime | Catalog it reads | What the user types |
| --- | --- | --- |
| Claude Code | `.claude-plugin/marketplace.json` | `/plugin marketplace add`, then `/plugin install` |
| Codex | `.agents/plugins/marketplace.json`, or the Claude path | `codex plugin marketplace add`, then `codex plugin add` |
| GitHub Copilot CLI | `.github/plugin/marketplace.json`, or the Claude path | `copilot plugin marketplace add`, then `copilot plugin install` |
| Cursor | `.cursor-plugin/marketplace.json` | nothing; an admin imports the repository as a team marketplace |

Read `references/runtimes.md` before writing any command into a README, and treat that file as the
only source of install commands. The trap that lives there: Codex installs with `plugin add` where
Copilot CLI uses `plugin install`.

## Workflow

### 1. Find what there is to list

```bash
ls plugins/*/plugin.json 2>/dev/null
test -f plugin.json && cat plugin.json
```

A catalog lists plugins found at `<scan-root>/<plugin-dir>/plugin.json`, which defaults to
`plugins/`. Pass `--plugin-scan-dir <dir>` when the repository keeps them elsewhere. A repository
whose only plugin sits at its root has nothing to discover; say so rather than generating an empty
catalog.

Discovery reads a plugin's `name` and nothing else. A missing or malformed `name` stops the command
before any write.

### 2. Choose targets with the user

Name the runtimes and what each one gets, using the table above. With no target flags the command
selects all four.

One catalog can serve two runtimes when the user wants fewer files: Codex reads the Claude catalog
too, so `--claude` alone covers both. The reverse does not hold, because Claude Code rejects the
Codex catalog for its missing `owner`. Generating both is the default, so each is idiomatic for its
runtime.

### 3. Generate

```bash
node scripts/marketplace.mjs --claude --copilot --dry-run
```

Resolve that path against this skill's own directory; `npx universal-plugin marketplace init` is the
fallback. Run `--dry-run` first and show the plan. The command never prompts.

Then generate for real. Selected targets compose as a union, so name every target you want each run.

| Status | Means |
| --- | --- |
| `generated` | written |
| `unchanged` | already correct, byte differences in key order and whitespace ignored |
| `planned` | `--dry-run` only |
| `empty` | nothing discovered for this target |

A selected artifact that differs from what would be generated stops the whole run. That is the
command protecting a hand-edited catalog. Read the difference, then re-run with `--force` only once
you know what it discards.

### 4. Offer the README section

Ask before writing. A README is the user's document, and this is an edit to it, not a new file.

```bash
node scripts/install-docs.mjs
```

Stdout is one JSON object: `targets`, `repo`, and `markdown`. Insert `markdown` verbatim. It carries
a section per generated catalog, built from the marketplace name and plugin names actually on disk.

Check `repoResolved` first. When it is `false` the repository slug could not be found and the
snippet contains `<owner>/<repo>`; ask the user for the slug and re-run with `--repo <owner>/<repo>`
rather than leaving a placeholder in their README.

If the README already has an install section, show the difference and let the user choose. Do not
append a second one.

### 5. Verify

Re-run the generator and confirm every selected target reports `unchanged`. Confirm each catalog
path exists. State plainly that nothing was published: these files sit in the repository until a
user adds it as a marketplace.

For Claude Code, check that each plugin `source` is a `./`-prefixed path that exists. Sources resolve
against the directory containing `.claude-plugin/`, and they do not resolve at all for a user who
adds the marketplace by direct URL to the JSON file.

A local path is the cheapest end-to-end proof:

```bash
codex plugin marketplace add "$(pwd)"
codex plugin list
codex plugin marketplace remove <marketplace-name>
```

`codex plugin list` prints the manifest path it read, which is what tells you the catalog was found
rather than merely present. Offer this check rather than running it unasked: it writes to the user's
Codex config. Remove what you added.

## Local development against Codex

Codex installs a cached copy keyed by plugin version, at
`~/.codex/plugins/cache/<marketplace>/<plugin>/<version>`. Editing the plugin's files does not reach
that copy.

After changing packaged files, reinstall and start a new session:

```bash
codex plugin remove <plugin>@<marketplace>
codex plugin add <plugin>@<marketplace>
```

The catalog's plugin version is derived from the canonical manifest, so a version move updates both;
`/universal-plugin:version` owns that.

## Rules

- **Never publish a command that is not in `references/runtimes.md`.** An install command that fails
  is worse than no install section. Widely-copied README snippets are not sources.
- **Name every catalog `marketplace.json`.** Codex discovers a catalog by that filename inside a
  supported directory. A file named anything else is invisible to it, whatever directory holds it.
- **Do not write a Cursor install command.** Cursor has no command that adds a repository catalog;
  a developer tests through `~/.cursor/plugins/local/<name>` and users get the plugin through a team
  marketplace an admin imports.
- **Ask before editing the README**, and before `--force` replaces a catalog the user may have
  hand-edited.
- This command publishes nothing and registers nothing. Say so in the report; a user who believes
  they have published will not understand why nobody can install.
- Listing a plugin in the shared `cyberuni/marketplace` repository is a different job: use
  `publish-plugin`.

## Related skills

| Task | Skill |
|------|-------|
| Create or change the plugin being listed | `init` |
| Check that the plugin's own manifests are current | `doctor` |
| Move the version users will install | `version` |
| Submit to the shared marketplace repository instead | `publish-plugin` |

## References

- `references/runtimes.md` — per-runtime install commands and their sources
- [Research conclusion](https://github.com/cyberuni/universal-plugin/blob/main/.research/local-marketplaces/conclusion.md)
- [`marketplace init` spec](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/marketplace/init/README.md)

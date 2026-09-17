# Route: init

Derive a catalog from the plugins this repository holds, then offer the README section that tells
users what to type.

For a plugin that lives elsewhere, see `references/add.md`. The two compose on one repository.

## 1. Find what there is to list

```bash
ls plugins/*/plugin.json 2>/dev/null
test -f plugin.json && cat plugin.json
```

`plugin init --vendor <id>` already registers the plugin it scaffolds in these catalogs, so a
repository that has run it carries an entry before this route starts. Read what is there first: this
command regenerates a catalog from what it discovers, which is the whole repository rather than one
plugin.

A catalog lists plugins found at `<scan-root>/<plugin-dir>/plugin.json`, which defaults to
`plugins/`. Pass `--plugin-scan-dir <dir>` when the repository keeps them elsewhere. A repository
whose only plugin sits at its root has nothing to discover; say so rather than generating an empty
catalog.

Discovery reads a plugin's `name` and nothing else. A missing or malformed `name` stops the command
before any write.

## 2. Choose targets with the user

Name the runtimes and what each one gets, using the table in `SKILL.md`. With no target flags the
command selects all four.

One catalog can serve two runtimes when the user wants fewer files: Codex reads the Claude catalog
too, so `--claude` alone covers both. The reverse does not hold, because Claude Code rejects the
Codex catalog for its missing `owner`. Generating both is the default, so each is idiomatic for its
runtime.

## 3. Generate

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

### What a regeneration keeps

Discovery walks directories, so it can only speak for plugins that are in them. Two things survive a
regeneration untouched:

- an entry whose source is **not** a local path — an npm package, a GitHub repository — which only
  `add` puts there
- the source of a **discovered** plugin whose entry names a non-local source, with its derived
  metadata refreshed around it

So a plugin shipped through npm, whose repository path holds gitignored build output, keeps pointing
at npm. What discovery owns it still owns: a local-path entry it no longer finds is dropped.

## 4. Validate every catalog

Follow `references/validate.md`. Never conclude without it.

## 5. Offer the README section

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

## 6. Verify

Re-run the generator and confirm every selected target reports `unchanged`. Confirm each catalog
path exists. State plainly that nothing was published: these files sit in the repository until a
user adds it as a marketplace.

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

Codex installs a **copy** of the plugin at
`~/.codex/plugins/cache/<marketplace>/<plugin>/<version>`, where the version is the one the plugin's
own manifest carries. Editing the plugin's files does not reach that copy.

After changing packaged files, install again and start a new session:

```bash
codex plugin add <plugin>@<marketplace>
```

That one command is the whole refresh: re-running it at the same version overwrites the cached copy
with the current source, so neither `codex plugin remove` nor a version bump is needed. Codex reads
the cache when a session starts, so the session you are in keeps the old copy — start a new one.

The catalog entry's version is derived from the canonical manifest, so a version move updates both
(`/universal-plugin:version` owns that). Codex itself does not read the entry's version; keeping it
true is this project's policy, so the catalog never states a version the plugin does not have.

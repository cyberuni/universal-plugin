---
title: bundle
description: Pin the skills' npx and upx references to the workspace versions being released.
---

Rewrite every `npx <pkg>@<version>` and `upx <pkg>@<version>` reference in the plugin's skills so
each workspace package is pinned to the version in its own local `package.json`, then write the
resolved versions to `.plugin/pins.json`. The result is the **release form** of the skills.

## Usage

```
universal-plugin plugin bundle [options]
```

## Options

| Flag | Description |
|---|---|
| `--dry-run` | Resolve and report the pins without writing the skills or `.plugin/pins.json` |
| `--full` | Show every pins row (the list truncates after 20 rows otherwise) |
| `--runner <npx\|upx>` | Runner word to write on every rewritten reference (default: keep each reference's own) |
| `--root <path>` | Plugin root directory (default: current directory) |
| `--format json` | Output as JSON |

## What it rewrites

`bundle` reads root `plugin.json` and scans every text file (`.md`, `.mdx`, `.markdown`, `.json`,
`.yaml`, `.yml`, `.txt`) under the skills directory, which is
`extensions["org.cyberuni.universal-plugin"].skills` or `skills/` by default. It collects each
reference shaped `npx <pkg>@<pin>` or `upx <pkg>@<pin>`, with an optional `--yes` or `-y` before the
package.

For each package it finds, it looks the package up in the workspace:

- **A workspace package with a readable version.** Every reference to it, in every in-scope file, is
  rewritten to that version. A placeholder such as `@<version>` resolves the same way, so all
  references to one CLI end up on the same number.
- **A workspace package whose `package.json` is missing or carries no version.** The package is
  skipped with a warning on stderr. The run still exits 0.
- **A package with no workspace entry**, such as a CLI from a separate repository. The references are
  left as they are. `bundle` never guesses a version for it.

A reference carries a version only when it has an explicit `@<pin>`. A bootstrap line such as
`npx skills add <repo> --skill <name>` has none, so `bundle` never touches it.

### The workspace is the only source

`bundle` reads no registry and makes no network call. At `changeset version` time the new version
is bumped in the local `package.json` but not yet published, so a registry lookup would pin to the
previous release. The local `package.json` is the version being shipped, and `bundle` takes it
verbatim, across a major boundary too.

The workspace is found by walking up from the plugin root to the nearest `pnpm-workspace.yaml` and
reading its `packages:` list. Only the `<dir>/*` glob shape and literal paths are expanded. With no
`pnpm-workspace.yaml`, or an empty list, `bundle` reads `packages/*`. A package is keyed by the
`name` in its `package.json`.

### Pin-exempt skills

A skill whose version strings are illustration rather than invocations, such as `upgrade-plugin`
showing `@<version>` or `@1.2.3`, declares itself pin-exempt in its `SKILL.md` frontmatter:

```yaml
---
name: upgrade-plugin
metadata:
  pin-exempt: true
---
```

Every file in that skill's directory is excluded. `bundle` does not scan it, rewrite it, or report a
row for it, even when the package it names is a workspace CLI.

### Choosing the runner word

Without `--runner`, each reference keeps the runner word it already has: an `npx` reference stays
`npx`, a `upx` reference stays `upx`, and only the version changes. `--runner upx` writes `upx` on
every rewritten reference, and `--runner npx` writes `npx`. Any other value fails with exit 1.

Emitting `upx` is opt-in because a released skill then needs `upx` on the consumer's `PATH`, while
`npx` ships with npm. See [Choosing a runner](../../concepts/npx-and-upx/) for that trade.

## Output

The result lists one row per package and a summary line:

```
pins[2]{package,current,resolved,status}:
  universal-plugin,0.12.1,0.12.2,pinned
  gherkin-cli,1.4.0,1.4.0,skipped
summary: "pinned 1, unchanged 0, skipped 1"
```

`current` is the first pin found for the package, and `resolved` is the version written.

| Status | Meaning | In `.plugin/pins.json` |
|---|---|---|
| `pinned` | A workspace package. At least one reference was rewritten | Yes |
| `unchanged` | A workspace package already at its workspace version | Yes |
| `skipped` | No workspace entry, or a workspace entry with no readable version | No |

`--format json` returns the full `pins` array. With no references to resolve, the run exits 0, reports
`pinned 0`, and prints `nothing to bundle` on stderr. A successful run ends with
`→ review and commit the pinned skills` on stderr. `bundle` never prompts.

## `.plugin/pins.json`

Each run that is not a dry run writes `<root>/.plugin/pins.json`, a flat map of the `pinned` and
`unchanged` packages, sorted by name:

```json
{
	"universal-plugin": "0.12.2"
}
```

A skill in the shipped plugin can read the version it was released with from
`${CLAUDE_PLUGIN_ROOT}/.plugin/pins.json` instead of scraping its own prose. Skipped packages are left
out, because they have no workspace version to record. The file is rewritten in full on every run,
keeping the indentation of the existing file (a tab for a new one).

## What `bundle` does not write

`bundle` writes the skill files and `.plugin/pins.json`, and nothing else. It does not touch the
canonical `plugin.json`, the vendor manifests, or the marketplace catalogs. Those belong to
[`plugin build`](../build/), which derives the form you develop against and runs constantly. `bundle`
derives the form you release and runs once the version being shipped is decided.

## Where it sits in a release

A version lives in several files, and only `plugin.json` and the `package.json` are authored. The
skills' pins are derived from the package version, and `bundle` is the command that owns them.

| Command | What it does with the skill pins |
|---|---|
| `plugin version <bump>` | Moves the authored version and rebuilds the vendor manifests. It does not touch the skill pins, and it ends by suggesting `→ universal-plugin plugin bundle` |
| `publish sync-version` | Copies the `package.json` version into `plugin.json`, then re-pins the skill references **to that one package** with `bundle`'s own rewriter. Other packages' pins and pin-exempt skills are left alone, and `.plugin/pins.json` is not written |
| `plugin bundle` | Re-pins **every** workspace package the skills reference, and writes `.plugin/pins.json` |
| `publish check-version` | Read-only. Fails when a skill pin of the plugin's own package carries a different version from `package.json` |

So in a changesets repository whose skills reference only the plugin's own package, the
`changeset version → publish sync-version → plugin build` release script already keeps the pins
current. Run `plugin bundle` as well when the skills pin other packages from the same workspace, or
when the plugin ships `.plugin/pins.json`. In a repository without changesets, run it after
`plugin version`.

`/universal-plugin:doctor-universal-plugin` reports a skill pin left behind as a `version-drift`
finding, skipping pin-exempt skills and pins that are not a concrete version (`<version>`, `latest`,
a range), as `bundle` does.

## Examples

```bash
# Preview the pins without writing anything
universal-plugin plugin bundle --dry-run --full

# Pin the skills and write .plugin/pins.json
universal-plugin plugin bundle

# Pin and switch every rewritten reference to upx
universal-plugin plugin bundle --runner upx
```

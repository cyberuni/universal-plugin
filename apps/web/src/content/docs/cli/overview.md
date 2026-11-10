---
title: CLI Overview
description: The universal-plugin CLI, its command groups and output formats.
---

The `universal-plugin` CLI transforms a canonical root `plugin.json` into vendor-specific manifests.

## Invocation

Always pin to an exact version in hooks and CI:

```bash
# One-off
npx universal-plugin@latest --help

# Scripting (pin)
npx universal-plugin@$(npm view universal-plugin version) <command>
```

## Commands

Manifest authoring lives under the `plugin` command group. The other groups sit at the top level.

| Command | Purpose |
|---|---|
| [`plugin build`](../build/) | Generate vendor manifests from root `plugin.json` |
| `plugin init` | Scaffold a canonical `plugin.json`, and register it in the [local marketplace](../marketplace/) |
| [`plugin install`](../install/) | Install the plugin under development into the runtimes it targets (and `plugin uninstall`) |
| [`plugin version`](#plugin-version-stamps-every-place) | Stamp the version into every place it lives, then rebuild |
| [`plugin bundle`](../bundle/) | Deprecated alias of `plugin version` |
| [`config`](../config/) | Read and write plugin-registered config in `.agents/universal-plugin.json` |
| `prepare` / `sync` | Detect and apply cross-vendor sync actions for an installed plugin |
| `publish sync-version` | Deprecated. Runs `plugin version --from-package` |
| `publish check-version` | Fail when `package.json`, `plugin.json`, the vendor manifests, the catalogs, the skill pins, or a marked `mcpServers` entry carry different versions. A place still on `0.0.0-development` is reported as `unstamped`, not as drift. Read-only, for CI |
| [`marketplace init`](../marketplace/) | Generate repository-local marketplace metadata |
| [`marketplace add`](../marketplace/#marketplace-add-lists-a-plugin-that-lives-elsewhere) | List a plugin that lives elsewhere — a path, a GitHub repo, an npm package, or another marketplace's entry |
| [`marketplace validate`](../marketplace/#marketplace-validate-checks-what-the-repository-carries) | Check those catalogs against the schema each runtime loads |
| `clean` | Remove the asset store |
| `self-update` | Update the version pin in `universal-plugin` hook files |

Run `--help` on any group for its flags. The
[package readme](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/readme.md)
carries the full list with examples.

## Derive and stamp

Two commands share the version, and they never overlap.

- **`plugin build` derives.** It writes each runtime's files from the source and never decides a
  version. Vendor manifests copy whatever `plugin.json` carries, and an `mcpServers` entry marked
  `pinToPluginVersion: true` is copied as authored with only the marker stripped. Build can run at any
  time under any release tool.
- **`plugin version` stamps.** One call writes the version into every place, then re-derives through
  `plugin build`.

### `plugin version` stamps every place

```
universal-plugin plugin version [options] [bump]
```

The version comes from one of four sources:

| Source | Call | Used by |
|---|---|---|
| Author bump | `plugin version minor` | Plain repositories, with no `packagePath` |
| Explicit number | `plugin version 1.4.0` | semantic-release, release-it |
| The package's `package.json` | `plugin version --from-package` | changesets, release-please with an npm package |
| The canonical `plugin.json` | `plugin version --from-manifest` | release-please with no `package.json` |

With `packagePath` declared in `.agents/universal-plugin.json`, a release type is refused. Bump the
package with the release tool, then run `--from-package`. An explicit number and `--from-package` stay
allowed. `--from-package` reads `<packagePath>/package.json`, or the plugin root's `package.json` when
no `packagePath` is declared, and refuses `0.0.0-development`. `--from-manifest` restamps every other
place at the number `plugin.json` already holds, with no advance guard, and is refused where
`packagePath` is declared.

It writes:

- `plugin.json`, and the `packagePath` `package.json` for a release type or an explicit number;
- every `npx`/`upx <pkg>@<version>` pin in the text files under the skills directory (Markdown,
  json/yaml, and `.js`, `.mjs`, `.cjs`, `.ts`, `.mts`, `.cts`, `.sh`, `.py` scripts). The plugin's own
  package moves to the new version, other pnpm-workspace CLIs to their workspace versions, and external
  packages are left alone. A skill with `metadata.pin-exempt: true` is skipped;
- `.plugin/pins.json`;
- the version each [compiled skill script](../build/#compiling-skill-scripts) embeds in its header;
- each authored `mcpServers` entry marked `pinToPluginVersion`, inline or in the mcp file, keeping the marker.

| Flag | Description |
|---|---|
| `--from-package` | Take the version the package's `package.json` already holds |
| `--from-manifest` | Restamp at the version `plugin.json` already holds |
| `--preid <id>` | Prerelease identifier for the `pre*` release types |
| `--force` | Allow a version that does not advance on the current one |
| `--no-build` | Skip re-deriving the vendor manifests |
| `--dry-run` | Print what would be written without writing |
| `--format <json\|toon>` | Output format |
| `--root <path>` | Plugin root directory |

Wire it into the release tool once:

| Tool | Wiring |
|---|---|
| changesets | `changeset version && universal-plugin plugin version --from-package --root <plugin>` as the root `version` script. `init --npm` writes it |
| release-please, npm package | `universal-plugin plugin version --from-package` after the release PR bumps the package |
| release-please, no `package.json` | a workflow step on the release PR runs `universal-plugin plugin version --from-manifest`, [below](#release-please-with-no-packagejson) |
| semantic-release | `@semantic-release/exec` with `prepareCmd: "universal-plugin plugin version ${nextRelease.version}"` |
| release-it | `"hooks": { "after:bump": "universal-plugin plugin version ${version}" }`, with `"npm": false` for a plugin that ships to no npm package |

semantic-release stamps files that exist only in the npm package unless `@semantic-release/git`
commits them back, with `assets` of `plugin.json`, the vendor manifests, `skills/**`,
`.plugin/pins.json`, and the mcp file. Git-sourced installs (Copilot CLI, GitHub-hosted marketplaces)
read `plugin.json` from the repository, so the commit-back is required for those channels. Without it
they are unsupported. `doctor` reports `semantic-release-no-stamp` when no `prepareCmd` runs
`plugin version`, and `semantic-release-npm-unshipped` when a plugin that ships to no npm package
still runs `@semantic-release/npm`. It reports `semantic-release-no-commit` when the stamp runs but
no `@semantic-release/git` commits it, and `semantic-release-git-before-exec` when git is listed
before exec, since plugins prepare in list order. See [ADR-0010](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/design/decisions/0010-version-policy.md) for the reasoning.

release-it with `"npm": false` ignores `package.json` and reads the current version from the latest
git tag, so a plugin with no package can release with it. The `after:bump` hook runs before the
release commit and tag, and the commit includes every tracked file the hook changed:

```json
{
  "npm": false,
  "hooks": { "after:bump": "universal-plugin plugin version ${version}" }
}
```

Before the first release, tag the commit that carries the current version (`git tag v1.2.0`).
release-it reads the tag, not `plugin.json`: without one it starts from `0.0.0`, and
`plugin version` refuses a number that does not advance.

`doctor` and `publish check-version` report a place that still holds `0.0.0-development` as
`unstamped` (severity low), apart from `version-drift`. The repair for a package-sourced drift is
`universal-plugin plugin version --from-package`.

#### release-please with no `package.json`

release-please releases a plugin with no `package.json`. `release-type: simple` keeps the number in
`.release-please-manifest.json` (`{ ".": "1.2.3" }`) and updates only `CHANGELOG.md` and a
`version.txt` it skips when absent. `extra-files` bumps `plugin.json`:

```json
{
  "packages": {
    ".": {
      "release-type": "simple",
      "extra-files": [{ "type": "json", "path": "plugin.json", "jsonpath": "$.version" }]
    }
  }
}
```

release-please runs no command before its release commit, so the vendor manifests, catalogs, skill
pins and compiled scripts stay on the old number. Restamp the release PR in the same workflow, right
after the action. `--from-manifest` takes the number `plugin.json` already holds.

Both pushes need a token that starts workflow runs. A push made with the default `GITHUB_TOKEN`
starts none, so the release PR's checks would never run on its head commit, and a required check
would block the merge. Mint a GitHub App token for the run and give it to release-please and to
`actions/checkout`, which pushes the restamp with it:

```yaml
on:
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - id: app-token
        uses: actions/create-github-app-token@v3
        with:
          client-id: ${{ vars.RELEASE_APP_CLIENT_ID }}
          private-key: ${{ secrets.RELEASE_APP_PRIVATE_KEY }}
      - id: release
        uses: googleapis/release-please-action@v5
        with:
          token: ${{ steps.app-token.outputs.token }}
      - if: ${{ steps.release.outputs.prs_created == 'true' }}
        uses: actions/checkout@v7
        with:
          ref: ${{ fromJSON(steps.release.outputs.pr).headBranchName }}
          token: ${{ steps.app-token.outputs.token }}
      - if: ${{ steps.release.outputs.prs_created == 'true' }}
        run: |
          npx -y universal-plugin@latest plugin version --from-manifest
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add -A
          git diff --cached --quiet || { git commit -m "chore: restamp the plugin version"; git push; }
```

Set the App up once:

1. Create a GitHub App with the repository permissions Contents, Pull requests and Issues set to
   read and write. release-please labels its PR through the Issues API.
2. Install it on the repository.
3. Store its client ID as the variable `RELEASE_APP_CLIENT_ID` and a private key as the secret
   `RELEASE_APP_PRIVATE_KEY`.

The workflow's own `GITHUB_TOKEN` then needs only `contents: read`, because every write goes through
the App token.

- release-please force-pushes its branch each time it updates the PR, which drops the restamp commit.
  The action reports an updated PR in `prs_created` as well, so the step runs again and restamps it.
- The App token is minted for this run, expires within an hour, and is revoked when the job ends.
  The private key is the one standing secret, and it reaches only the repositories the App is
  installed on. A personal access token works too, but it is long-lived and acts as a person.
- `release-please-action@v5` and `actions/checkout@v7` run on Node 24. A self-hosted runner needs
  Actions Runner v2.327.1 or later.
- Do not re-run CI with `workflow_dispatch` (`gh workflow run`) instead. Checks from a
  `workflow_dispatch` run do not count toward a required check.
- Do not list the stamped files in `extra-files` instead. The skill pins and the compiled script
  headers are not a `$.version` field, and the vendor manifests and catalogs belong to `plugin build`.
- With `packagePath` declared, bump the package and run `--from-package` instead. `--from-manifest` is
  refused there.

`doctor` reports `release-please-no-restamp` when `extra-files` bumps `plugin.json` and no workflow runs
`plugin version`, and `release-please-restamp-no-ci` when the restamp is pushed with the default
`GITHUB_TOKEN`.

### Deprecated commands

`plugin bundle` and `publish sync-version` print a warning and will be removed in a later release.
`sync-version` now runs `plugin version --from-package`. Pinning was never bundling, and "bundle" is
reserved for compiling skill scripts into one self-contained file.

## Fast alternative: upx

[`@repobuddy/upx`](https://github.com/repobuddy/upx) (`npm i -g @repobuddy/upx`) runs an
already-installed CLI directly instead of resolving one on every call. See
[Choosing a runner](../../concepts/npx-and-upx/) for the cases where `npx` is still the right
runner.

## Output formats

Most subcommands accept `--format`:

| Value | Consumer | Output |
|---|---|---|
| _(default)_, `--format toon` | Agents | [TOON](https://toonformat.dev/), roughly 40% fewer tokens than JSON |
| `--format json` | Scripts and pipelines | The full structured result |

A TOON result carries three or four fields per row plus a `summary` line with the counts, so no
follow-up call is needed to learn how the run went:

```
vendors[2]{vendor,path,status}:
  claude-code,.claude-plugin/plugin.json,built
  cursor,.cursor-plugin/plugin.json,built
summary: "built 2, skipped 0, failed 0"
```

`--format json` returns more than the default view, including every warning.

stdout carries the result and nothing else. Next-step lines, warnings, and errors go to stderr, so
piping stdout into a parser stays clean.

`--json` is a deprecated alias for `--format json`.

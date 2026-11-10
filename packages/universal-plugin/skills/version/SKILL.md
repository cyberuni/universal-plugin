---
name: version
description: Use this skill to move a universal agent plugin's version — bump it, set an explicit one, cut a release number, or reconcile a version that drifted between the canonical plugin.json and its npm package.json. Handles every release model: a plain repository, where the author picks the number, and a release tool (changesets, release-please, semantic-release, release-it) that decides it and hands it to plugin version to stamp everywhere. Trigger on "bump the plugin version", "release a new version of this plugin", "set the plugin version to 1.0.0", "cut a patch release", or "the manifest and package.json versions disagree".
---

# Move a plugin's version

Stamp the version a plugin releases under into every file that carries one.

The seam is **derive versus stamp**. `plugin build` derives the vendor manifests from `plugin.json`
and never decides a version. `plugin version` is the one command that decides where a number goes: a
single call writes it into every place, then re-derives through `plugin build`. So never hand-edit a
version. Editing one file leaves the rest stale, and a consumer's plugin cache is keyed by version, so
a content change without a matching bump is invisible to them.

One call writes:

- the canonical `plugin.json`, and the `packagePath` `package.json` when you pass a release type or an
  explicit number;
- every `npx`/`upx <pkg>@<version>` pin in the text files under the skills directory (SKILL.md, other
  Markdown, json/yaml, and `.js`/`.mjs`/`.cjs`/`.ts`/`.mts`/`.cts`/`.sh`/`.py` scripts). The plugin's
  own package moves to the new version, other pnpm-workspace CLIs to their workspace versions, and
  external packages are left alone. A skill with `metadata.pin-exempt: true` is skipped;
- `.plugin/pins.json`;
- the version each compiled skill script (`scripts` in the extension) embeds in its header — only the
  header moves;
- each authored `mcpServers` entry marked `pinToPluginVersion: true`, inline or in the mcp file. The
  marker stays.

## Step 1 — Pick the source of the number

Ask who decides the number. There are three sources, and the release model picks one:

| Source | Call | Used by |
|---|---|---|
| Author bump | `plugin version minor` | Plain repositories, with no `packagePath` |
| Explicit number | `plugin version 1.4.0` | semantic-release, release-it |
| The package's `package.json` | `plugin version --from-package` | changesets, release-please with an npm package |
| The canonical `plugin.json` | `plugin version --from-manifest` | release-please with no `package.json` (`extra-files`) |

```bash
test -d .changeset && echo "changesets"
ls .release-it.* 2>/dev/null; grep -q '"release-it"' package.json 2>/dev/null && echo "release-it"
cat .agents/universal-plugin.json   # is packagePath declared?
```

With `packagePath` declared, a release type (`patch`, `minor`, `major`, `pre*`) is **refused**: the
package owns the number. Bump the package with the release tool, then run `--from-package`. An
explicit number and `--from-package` stay allowed. `--from-package` reads `<packagePath>/package.json`,
or the plugin root's `package.json` when no `packagePath` is declared, and refuses `0.0.0-development`.

Wire a release tool once; after that the release runs the stamp for you:

- **changesets.** Root `version` script: `changeset version && universal-plugin plugin version --from-package --root <plugin>`.
  `init-universal-plugin --npm` writes it.
- **release-please, npm package.** Run `universal-plugin plugin version --from-package` after the
  release PR bumps the package.
- **release-please, no `package.json`.** `extra-files` bumps `plugin.json`, and a workflow step on the
  release PR runs `universal-plugin plugin version --from-manifest`. See the section below.
- **semantic-release.** Add `@semantic-release/exec` with
  `prepareCmd: "universal-plugin plugin version ${nextRelease.version}"`.
- **release-it.** Run the stamp in the `after:bump` hook. For a plugin that ships to no npm package,
  set `"npm": false` so release-it ignores `package.json`; see below.

In a changesets repository, add a changeset and let the release run. Do not run `plugin version minor`
there: it would decide a number changesets is about to decide again.

### semantic-release must commit the stamp back

The stamped files exist only in the npm package unless `@semantic-release/git` commits them back.
Git-sourced installs (Copilot CLI, GitHub-hosted marketplaces) read `plugin.json` from the repository,
so for those channels the commit-back is required. Without it they are unsupported. Set `assets` to
`plugin.json`, the vendor manifests, the repository catalogs (`.claude-plugin/marketplace.json`,
`.cursor-plugin/marketplace.json`, `.agents/plugins/marketplace.json`,
`.github/plugin/marketplace.json`), `skills/**`, `.plugin/pins.json`, and the mcp file. The stamp
re-derives the catalogs too, so leaving them out leaves them a release behind.

`doctor` reports `semantic-release-no-stamp` when no `prepareCmd` runs `plugin version`, and
`semantic-release-npm-unshipped` when a plugin that ships to no npm package still runs
`@semantic-release/npm`.

### release-please with no `package.json`

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
after the action. `--from-manifest` takes the number `plugin.json` already holds:

```yaml
on:
  push:
    branches: [main]
permissions:
  contents: write
  pull-requests: write
jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - id: release
        uses: googleapis/release-please-action@v4
      - if: ${{ steps.release.outputs.prs_created == 'true' }}
        uses: actions/checkout@v4
        with:
          ref: ${{ fromJSON(steps.release.outputs.pr).headBranchName }}
      - if: ${{ steps.release.outputs.prs_created == 'true' }}
        run: |
          npx -y universal-plugin@0.17.1 plugin version --from-manifest
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add -A
          git diff --cached --quiet || { git commit -m "chore: restamp the plugin version"; git push; }
```

- release-please force-pushes its branch each time it updates the PR, which drops the restamp commit.
  The action reports an updated PR in `prs_created` as well, so the step runs again and restamps it.
- A push made with the default `GITHUB_TOKEN` starts no workflow run, so the PR's checks do not run on
  the restamp commit. Pass a token from a GitHub App or a PAT to `actions/checkout` (`token:`) when the
  PR's checks must see it.
- Do not list the stamped files in `extra-files` instead. The skill pins and the compiled script
  headers are not a `$.version` field, and the vendor manifests and catalogs belong to `plugin build`.
- With `packagePath` declared, bump the package and run `--from-package` instead. `--from-manifest` is
  refused there.

`doctor` reports `release-please-no-restamp` when `extra-files` bumps `plugin.json` and no workflow runs
`plugin version`.

### release-it reads the version from the git tag

With `"npm": false`, release-it needs no `package.json`. Its `after:bump` hook runs before the release
commit and tag, and the commit includes every tracked file the hook changed, so the stamp ships in the
tagged commit. In `.release-it.json`:

```json
{
  "npm": false,
  "hooks": { "after:bump": "universal-plugin plugin version ${version}" }
}
```

Before the first release, tag the commit that carries the current version (`git tag v1.2.0`).
release-it reads the tag, not `plugin.json`: without one it starts from `0.0.0`, and
`plugin version` refuses a number that does not advance.

## Step 2 — Run it

```bash
node scripts/version.mjs <bump-or-number>
node scripts/version.mjs --from-package
node scripts/version.mjs --from-manifest
```

Resolve that path against this skill's own directory; it runs the project's installed CLI
(`pnpm exec universal-plugin`), else `npx universal-plugin@0.17.1` pinned to this skill's version.
`universal-plugin plugin version` on the `PATH` is the fallback. The command never prompts, so it is safe to run unattended once the
source is decided.

| `<bump>` | From `1.2.3` you get |
|---|---|
| `patch` | `1.2.4` |
| `minor` | `1.3.0` |
| `major` | `2.0.0` |
| `prerelease --preid beta` | `1.2.4-beta.0` |
| `2.0.0-rc.1` (explicit) | `2.0.0-rc.1` |

| Flag | Effect |
|---|---|
| `--from-package` | Take the version the package's `package.json` already holds |
| `--from-manifest` | Restamp at the version `plugin.json` already holds; refused under `packagePath` |
| `--preid <id>` | Prerelease identifier for the `pre*` release types |
| `--dry-run` | Print the plan, write nothing. Run this first when unsure |
| `--force` | Allow a target that does not advance on the current version |
| `--no-build` | Skip re-deriving the vendor manifests (run `plugin build` yourself) |
| `--format json` | Machine-readable result |
| `--root <path>` | Plugin root directory |

**Which release type?** In a plain repository that is the user's call, not the command's and not yours
to guess. A version is a promise to consumers about what broke. If the user has not said, ask, and
offer the semver reading of the change: breaking → `major`, new behavior → `minor`, fix only →
`patch` (on a `0.x` plugin, breaking → `minor` and everything else → `patch`).

## Step 3 — Confirm what moved

The command reports every file it wrote and every manifest it re-derived. Expect the canonical
manifest, the `packagePath` `package.json` for a release type or explicit number, the pinned skill
files, `.plugin/pins.json`, and one derived manifest per declared harness:

```bash
node scripts/version.mjs --from-package --format json
```

Default stdout is TOON, which is the machine contract this CLI documents; `--format json` is there
for non-LLM consumers. Either way, read the reported files rather than re-deriving what moved.

If the plugin declares no harnesses, only the authored files are written — that is correct, not a
failure.

## Guards

Every guard resolves before the first write, so a failed run leaves the tree untouched.

| Message names | What it means | Do this |
|---|---|---|
| a missing `plugin.json` | not at a plugin root, or the plugin was never scaffolded | `cd` to the plugin root, or run `/universal-plugin:init-universal-plugin` (pnpm install: `pnpm-universal-plugin-init-universal-plugin`) |
| no version to bump from | the manifest has never carried a `version` | pass an explicit version (`plugin version 0.1.0`) to set the first one |
| an unknown version or release type | the argument is neither a release type nor valid semver | use one of the values in the table above |
| a target that does not advance | the requested version is not greater than the current one | pick a higher version, or pass `--force` if the user genuinely wants to move backward |
| a release type under `packagePath` | the package owns the number | bump the package with the release tool, then `plugin version --from-package` |
| `0.0.0-development` from `--from-package` | semantic-release's placeholder, not a release | pass the explicit number instead |
| `--from-manifest` under `packagePath` | the package owns the number | run `--from-package` instead |
| a missing `package.json` at `packagePath` | `.agents/universal-plugin.json` names a package directory that does not exist | fix `packagePath`, or create the package |

## Do not

- **Hand-edit a `version` field.** The other places fall out of sync.
- **Write a derived manifest.** `.claude-plugin/plugin.json` and its siblings belong to
  `plugin build`; the bump already re-derived them.
- **Run `npm version`.** It knows only `package.json` and leaves the canonical manifest and the
  skill pins stale.
- **Use the deprecated commands.** `plugin bundle` and `publish sync-version` print a deprecation
  warning; use `plugin version` instead. `sync-version` now runs `plugin version --from-package`.

## Related skills

| Task | Skill |
|------|-------|
| Create, adopt, or change what the plugin declares | `init-universal-plugin` |
| Re-derive the vendor manifests by hand | `build-plugin` |
| Check whether every place agrees (`unstamped`, `version-drift`) | `doctor-universal-plugin` |
| Add a changeset for the change being released | `buddy-changesets:changesets` |
| Refresh the repository's own marketplace catalogs after a bump | `marketplace` |
| List the released plugin in the shared marketplace | `publish-plugin` |

## References

- [ADR-0010](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/design/decisions/0010-version-policy.md), the derive/stamp seam
- Spec: [`plugin/version/`](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/plugin/version/README.md)

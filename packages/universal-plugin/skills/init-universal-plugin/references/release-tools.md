# Release tool wiring

Each release tool decides the release number in its own way. The plugin still needs that number
stamped into `plugin.json`, the vendor manifests, the catalogs, and the skill pins. The `version`
skill owns the stamp: `plugin version` with a number the tool hands it. This file covers the wiring
that makes a release tool call it.

`plugin init` writes the changesets wiring itself (SKILL.md Phase 3). It writes nothing for the
other tools. Their config takes several file formats, JavaScript modules among them, and it often
carries plugins the user added. Editing it is a judgment call, so the skill makes the edit and the
user approves it.

| Tool | Config the survey finds | Wiring |
| --- | --- | --- |
| changesets | `.changeset/` | `plugin init` writes it (SKILL.md Phase 3) |
| semantic-release | `.releaserc`, `.releaserc.{json,yaml,yml,js,cjs,mjs}`, `release.config.{js,cjs,mjs}`, or a `release` key in `package.json` | [below](#semantic-release) |
| release-it | `.release-it.{json,yaml,yml,toml,js,cjs,ts}`, or a `release-it` key in `package.json` | [below](#release-it) |
| release-please | `release-please-config.json`, `.release-please-manifest.json` | [below](#release-please) |

## semantic-release

semantic-release writes the version only during its own run. Two plugins carry the number into the
plugin:

- **`@semantic-release/exec`** runs the stamp in its `prepare` step:
  `prepareCmd: "universal-plugin plugin version ${nextRelease.version}"`. semantic-release fills in
  `${nextRelease.version}` with its lodash template. Add `--root <plugin-root>` when the plugin root
  is not the repository root.
- **`@semantic-release/git`** commits the stamped files back. Copilot CLI and GitHub-hosted
  marketplaces read `plugin.json` from the repository, not from a package, so without this commit
  those channels never see the new number (ADR-0010 §2).

A `plugins` list replaces semantic-release's default list. It does not merge with it. The defaults
are `commit-analyzer`, `release-notes-generator`, `npm`, and `github`. A config with no `plugins`
key therefore gets the full list written out, minus whatever the case below drops.

Within each step, plugins run in list order. Put `exec` after `npm` and before `git`. That way `npm`
moves `package.json` first, `exec` stamps the plugin, and `git` commits both.

### A plugin that ships to no npm package

Drop `@semantic-release/npm` from the list. `npmPublish: false` does not cover this: the plugin
still sets `package.json` `version`, and it requires a `package.json` that a git-installed plugin
usually lacks. Without `npm`, semantic-release needs no `package.json` at all.

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    ["@semantic-release/exec", {
      "prepareCmd": "npx universal-plugin@0.20.1 plugin version ${nextRelease.version}"
    }],
    ["@semantic-release/git", {
      "assets": [
        "plugin.json",
        ".claude-plugin/**",
        ".cursor-plugin/**",
        ".codex-plugin/**",
        ".agents/plugins/marketplace.json",
        ".github/plugin/**",
        "com.github.copilot/**",
        "skills/**",
        ".plugin/pins.json"
      ]
    }],
    "@semantic-release/github"
  ]
}
```

With no `package.json`, `universal-plugin` is not installed, so the command runs it through `npx`.
Pin it to the CLI version this skill ships with, as shown. The `upgrade-plugin` skill moves that pin
later.
Where the repository does install `universal-plugin` as a devDependency, use the bare
`universal-plugin` instead.

### A plugin that ships on npm

Keep `@semantic-release/npm` and add the other two after it:

```json
["@semantic-release/npm"],
["@semantic-release/exec", { "prepareCmd": "universal-plugin plugin version ${nextRelease.version}" }],
["@semantic-release/git", { "assets": ["package.json", "plugin.json", "..."] }]
```

Setting `assets` replaces the git plugin's default list, which holds `package.json`,
`package-lock.json`, `npm-shrinkwrap.json`, and `CHANGELOG.md`. List again each of those the
repository needs, alongside the plugin files above.

### Assets

`plugin version` rewrites `plugin.json` and the skill pins, and then re-derives every vendor
manifest and repository catalog. Commit all of them, or the repository's files disagree with the
tag. The list above covers every place the CLI writes. A glob that matches nothing adds nothing, so
the whole list is safe to keep for a plugin that does not declare every vendor. Under a plugin root
below the repository root, prefix the plugin's own paths with that root. The catalogs
(`.claude-plugin/marketplace.json`, `.cursor-plugin/marketplace.json`,
`.agents/plugins/marketplace.json`, `.github/plugin/marketplace.json`) stay at the repository root.
Add the mcp file when the plugin declares one.

The git plugin's default commit message ends in `[skip ci]`, so the commit back does not start
another release.

### Applying it

1. Edit the config file the survey found, in its own format. For a JavaScript config, edit the
   `plugins` array in place. If no config exists, write `.releaserc.json`.
2. Keep every plugin the user already lists, and keep their order relative to each other.
3. Show the before and after `plugins` list in the Phase 3 plan. Apply only once the user approves.
4. Name the packages the release job must install: `@semantic-release/exec` and
   `@semantic-release/git`. The `--no-ci` local run, and the CI job that runs semantic-release, both
   need them. Installing them is the user's step. Do not edit the CI workflow (SKILL.md Rules).

## release-it

release-it runs its `after:bump` hook after it settles the new number and before its release
commit and tag. That commit stages every tracked file the hook changed (`git add . --update`), so
the stamp ships in the tagged commit with no extra plugin. `${version}` in a hook is the new number.

### A plugin that ships to no npm package

Set `"npm": false`. release-it then ignores `package.json`, needs none, and reads the current version
from the latest git tag. Add the stamp as the `after:bump` hook:

```json
{
  "npm": false,
  "hooks": {
    "after:bump": "npx universal-plugin@0.20.1 plugin version ${version}"
  }
}
```

With no `package.json`, `universal-plugin` is not installed, so the hook runs it through `npx`. Pin
it to the CLI version this skill ships with, as shown. The `upgrade-plugin` skill moves that pin
later.

### A plugin that ships on npm

Keep release-it's npm plugin. It bumps `package.json`, and the hook then stamps the same number into
the plugin:

```json
{
  "hooks": { "after:bump": "universal-plugin plugin version ${version}" }
}
```

Use the bare `universal-plugin` when the repository installs it as a devDependency, as an
npm-shipped plugin usually does. Otherwise use the pinned `npx` form above. Here release-it reads
the current version from `package.json`, so the first release needs no tag.

Add `--root <plugin-root>` to the hook when release-it runs from a directory other than the plugin
root.

### The first release needs a tag

With `"npm": false`, release-it reads the current number from the latest tag, never from
`plugin.json`. With no tag it starts from `0.0.0`, proposes `0.0.1`, and the stamp refuses a number
that does not advance on the version `plugin.json` holds. The release then fails.

So, when the plugin ships to no npm package, check for a tag in the Phase 3 plan:

```bash
git describe --tags --abbrev=0
```

If that finds no tag, propose tagging the current commit with the version `plugin.json` holds, and
create the tag once the user approves:

```bash
git tag v1.2.0
```

- Use `v<version>` unless the repository already tags in another form. release-it names its next
  tag after the latest one, so the first tag sets the form every later release keeps.
- A lightweight tag is enough. release-it finds it with `git describe --tags`.
- Tag the commit whose `plugin.json` holds that version, and only after the plugin's files are
  committed. Do not move or replace an existing tag.
- The tag is local until pushed. A release that runs in CI needs it on the remote. Pushing it is the
  user's step, so name `git push origin v1.2.0` and run it only if the user asks.
- If the user declines, say the first release fails until a tag on the current version exists.

### Applying it

1. Edit the config the survey found, in its own format: a `.release-it.*` file, or the `release-it`
   key in `package.json`. If none exists, write `.release-it.json`.
2. Keep every key the user already set. If an `after:bump` hook already exists, keep its command and
   run the stamp after it: a string becomes an array of both commands. Show the hooks before and
   after in the Phase 3 plan. Apply only once the user approves.
3. For a plugin that ships to no npm package, set `"npm": false`, and handle the tag as above.
4. Commit the plugin's generated files (`plugin.json`, the vendor manifests, the catalogs,
   `.plugin/pins.json`) before the first release. The release commit stages only tracked files, so
   a stamped file git does not track yet stays out of the tagged commit.
5. Installing release-it is the user's step. Do not edit the CI workflow (SKILL.md Rules).

`doctor` reports `release-it-no-stamp` for a release-it config that never runs `plugin version`.

## release-please

release-please runs no command before its release commit. Its release PR moves the number in the
files it knows, and a workflow step on that PR then restamps the plugin. The wiring is two files the
skill writes, and one workflow step the user adds.

### A plugin that ships to no npm package

`release-type: simple` keeps the number in `.release-please-manifest.json`, and `extra-files` bumps
`plugin.json`. Write `release-please-config.json`:

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

The restamp step runs `npx -y universal-plugin@0.20.1 plugin version --from-manifest`, which takes
the number `plugin.json` already holds. Pin it to the CLI version this skill ships with.

### A plugin that ships on npm

`release-type: node` bumps `package.json`. The restamp step runs
`universal-plugin plugin version --from-package` instead. Do not add `plugin.json` to `extra-files`
here: the package owns the number, and `--from-package` carries it into the plugin.

### The manifest holds the current version

release-please reads the last release from `.release-please-manifest.json`. A package with no entry
starts from a default version, not from the plugin's. Write the entry with the version `plugin.json`
holds, keyed by the package path:

```json
{ ".": "1.2.0" }
```

For a plugin below the repository root, use its path as the key in both files (`"packages/my-plugin"`),
and make `extra-files` paths relative to that package.

### The workflow step

The `version` skill's section *release-please with no `package.json`* has the workflow: a GitHub
App token minted for the run, the release-please action given that token, then a checkout of the
release PR branch with the same token, the restamp, and a commit pushed back. Show it in the plan and
hand it to the user. Do not write or edit the workflow (SKILL.md Rules). For an npm-shipped plugin,
the step runs `--from-package` in place of `--from-manifest`.

The token matters. A push made with the default `GITHUB_TOKEN` starts no workflow run, so the
release PR's checks never run on its head commit and a required check blocks the merge. Tell the
user the App setup the workflow needs: an App with Contents, Pull requests and Issues set to read and
write, installed on the repository, its client ID in the variable `RELEASE_APP_CLIENT_ID` and a
private key in the secret `RELEASE_APP_PRIVATE_KEY`. Do not offer a `workflow_dispatch` re-run of CI
instead: its checks do not count toward a required check.

### Applying it

1. If `release-please-config.json` exists, add `extra-files` to the plugin's package entry and keep
   every other key. If it does not, write the config above.
2. Add the plugin's entry to `.release-please-manifest.json`, or write the file. Never lower or
   replace an entry that already exists: that is the last released version.
3. Show both files before and after in the Phase 3 plan. Apply only once the user approves.
4. Hand over the workflow step and the App setup.

`doctor` reports `release-please-no-restamp` when `extra-files` bumps `plugin.json` and no workflow
runs `plugin version`, and `release-please-restamp-no-ci` when the restamp is pushed with the default
`GITHUB_TOKEN`.

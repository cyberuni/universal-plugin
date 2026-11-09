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
| release-it | `.release-it.{json,yaml,yml,toml,js,cjs,ts}` | [below](#release-it) |
| release-please | `release-please-config.json` | [below](#release-please) |

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
      "prepareCmd": "npx universal-plugin@0.17.1 plugin version ${nextRelease.version}"
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

Not wired by this skill yet. Issue
[#237](https://github.com/cyberuni/universal-plugin/issues/237) documents the release-it wiring.
Until it lands, hand the user to the `version` skill and name the stamp release-it must call:
`universal-plugin plugin version <number>` after release-it bumps the version, with the stamped
files committed in release-it's release commit.

## release-please

Not wired by this skill yet. Issue
[#238](https://github.com/cyberuni/universal-plugin/issues/238) documents the release-please
wiring. Until it lands, hand the user to the `version` skill. release-please bumps `package.json` in
its release PR, so the stamp is `universal-plugin plugin version --from-package` run on that PR.

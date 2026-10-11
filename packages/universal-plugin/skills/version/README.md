# version skill

Stamp the version a plugin releases under into every file that carries one.

## Derive versus stamp

`plugin build` derives the vendor manifests from `plugin.json` and never decides a version.
`plugin version` stamps: one call writes the number into the canonical `plugin.json`, the
`packagePath` `package.json`, every `npx`/`upx <pkg>@<version>` pin in the skills, `.plugin/pins.json`,
and each `mcpServers` entry marked `pinToPluginVersion`, then re-derives through `plugin build`.

That is why nothing here is hand-edited. A consumer's plugin cache is keyed by version, so a content
change without a matching bump is invisible to them.

## Three sources for the number

| Source | Call | Used by |
|---|---|---|
| Author bump | `plugin version minor` | Plain repositories |
| Explicit number | `plugin version 1.4.0` | semantic-release (`@semantic-release/exec` `prepareCmd`) |
| The package's `package.json` | `plugin version --from-package` | changesets, release-please |

With `packagePath` declared, a release type is refused: bump the package with the release tool, then
run `--from-package`. The skill checks for `.changeset/` and `packagePath` before it picks a call.

semantic-release stamps files that exist only in the npm package unless `@semantic-release/git`
commits them back. Git-sourced installs read `plugin.json` from the repository, so they need that
commit-back.

`plugin bundle` and `publish sync-version` are deprecated aliases and are removed in the next minor
release.

## The part that is not automatable

Which release type to use is a promise to consumers about what broke. The skill offers the semver
reading (breaking → major, new behavior → minor, fix only → patch, adjusted for `0.x`) and asks
rather than guessing.

## References

- [ADR-0010](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/design/decisions/0010-version-policy.md)
- [`plugin version` spec](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/plugin/version/README.md)

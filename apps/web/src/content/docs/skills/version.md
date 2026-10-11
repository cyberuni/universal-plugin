---
title: version
description: Stamp the number a plugin releases under into every place it lives.
---

Stamps the number a plugin releases under. `plugin build` derives the vendor manifests and never
decides a version; `plugin version` is the command that writes it, in one call, into `plugin.json`,
the package's `package.json`, the skills' `npx`/`upx` pins, `.plugin/pins.json`, and marked
`mcpServers` entries. See the [CLI overview](../../cli/overview/#plugin-version-stamps-every-place) for the flags.

The skill's first question is who decides the number:

| Source | Call | Used by |
|---|---|---|
| Author bump | `plugin version minor` | Plain repositories |
| Explicit number | `plugin version 1.4.0` | semantic-release |
| The package's `package.json` | `plugin version --from-package` | changesets, release-please |

Which release type to use is not the skill's call. A version is a promise about what broke, so the
skill offers the semver reading and asks. With `packagePath` declared it does not offer a release type
at all: the package owns the number.

## See also

- [CLI overview](../../cli/overview/#plugin-version-stamps-every-place) for the command, the places it writes, and the release-tool wiring
- [`upgrade-plugin`](../upgrade-plugin/) moves the version your project *calls*, a different number
- [ADR-0010](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/design/decisions/0010-version-policy.md)

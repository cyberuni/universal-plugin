---
"universal-plugin": minor
---

The `init-universal-plugin` skill now wires release-it and release-please when the survey finds them or the user picks them, once the user approves. For release-it it adds an `after:bump` hook running `plugin version ${version}`, sets `"npm": false` for a plugin that ships to no npm package, and offers to tag the current commit with the plugin's version when the repository has no tag, since release-it then reads the current version from the tag. For release-please it writes `release-please-config.json` (`release-type: simple` with an `extra-files` entry for `plugin.json`, or `release-type: node` for an npm package) and seeds `.release-please-manifest.json` with the current version, and it hands the user the workflow step that restamps the release PR. `plugin init` gets no new flag.

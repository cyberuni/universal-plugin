---
"universal-plugin": minor
---

`doctor` reports `release-please-restamp-no-ci` when a workflow pushes the `--from-manifest` restamp with the default `GITHUB_TOKEN`. That push starts no workflow run, so the release PR's checks never run on its head commit and a required check blocks the merge. The `version` skill's release-please workflow now mints a GitHub App token with `actions/create-github-app-token` and passes it to release-please and to `actions/checkout`.

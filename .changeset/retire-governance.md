---
"universal-plugin": minor
---

Retire `governance` and the build's governance copies in favor of `buddy-agent-harness reference` and its `load-reference` skill.

- `governance show` and `governance list` no longer read documents. For this release they print the replacement (`buddy-agent-harness reference show <name>`, or the `load-reference` skill in the `buddy-agent-harness` plugin) and exit 1. The next release removes the command.
- `plugin build` no longer copies governances into `skills/*/references/governances/`, and `plugin build --check` is gone. Remove `--check` from CI; it now fails as an unknown option.
- The documents this package owns (`plugin-design`, `slash-invocation`, and a `universal-plugin` pointer to `plugin-design`) ship under `references/` instead of `governances/`, so `reference show` finds them in any project that depends on `universal-plugin`.
- The `init-universal-plugin` skill loads `plugin-design` through the `load-reference` skill.

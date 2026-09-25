# build-plugin skill

Derive every vendor's form of a plugin from its one canonical `plugin.json`.

## When to use

- "build the plugin", "run plugin build"
- "regenerate the vendor manifests", "sync the manifests after my change"
- "check the governance copies are current", in CI

## What it does

Runs `plugin build`, which writes the Claude Code, Cursor, and Codex manifests and Copilot CLI's
`com.github.copilot/` tree. It also refreshes this plugin's entry in the repository's marketplace
catalogs and the governance copies inside its skills. The skill prefers the project's own build
script, otherwise runs `scripts/build.mjs`, which uses the CLI shipped beside the skill, so nothing
is downloaded.

The skill reads the result back to the user: which vendors were built, which catalogs changed, and
each warning about something a vendor cannot represent. A `built 0` result is handed to `doctor`
rather than reported as success. `--check` gates CI on committed governance copies without writing
anything.

## Install

Ships with the `universal-plugin` plugin. It is invoked in Claude Code as
`/universal-plugin:build-plugin`.

## References

- [`plugin build` spec](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/plugin/build/README.md)

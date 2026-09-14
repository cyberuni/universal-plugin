---
"universal-plugin": minor
---

Add `universal-plugin plugin validate`, which checks the root `plugin.json` without building anything. It reports every problem in one pass, in two groups:

- **Schema violations** against the Agent Plugins 1.0.0 schema: `$schema` and `name` are required, `name` must match the schema's pattern, fields must have the right types, and top-level keys the standard does not define are rejected.
- **Vendor violations**: for example, Codex requires `description` and `version`. `--vendor <id>` limits these checks to one vendor.

An unknown vendor key in `harnesses` is a warning, and `--strict` makes it a violation. Output is TOON by default, with `--format json` and `--full` available. Running `universal-plugin plugin` with no subcommand now validates the current project and lists its declared harnesses, instead of printing help.

A manifest without `$schema` now fails `plugin validate`. `plugin build` does not check `$schema` and still accepts it. `plugin init` already writes `$schema`.

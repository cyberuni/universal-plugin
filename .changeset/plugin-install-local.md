---
'universal-plugin': minor
---

Add `plugin install` and `plugin uninstall` — put the plugin under development into a runtime, instead of hand-writing a symlink.

Getting a working copy into a runtime meant a symlink per vendor, copy-pasted into every plugin repository's readme. Re-verifying that recipe against the shipped runtimes found both halves wrong: `~/.claude/plugins/local/` does not exist in Claude Code — the path that works is its skills directory, which adopts a plugin and loads it as `<name>@skills-dir` — and Cursor's `~/.cursor/plugins/local/` resolves each symlink and refuses a target outside itself. An author following those two lines got silence from both runtimes and no way to tell why.

`plugin install` installs into every vendor the canonical manifest already declares, `--vendor <id>` narrows it, and `--list` shows the resolved destinations without writing. Each vendor's local plugin directory now lives in the vendor registry alongside every other vendor path this tool knows, so a vendor moving its directory is one line here rather than a stale command in every downstream readme — and a machine with a runtime configured elsewhere can override it in `~/.agents/universal-plugin-vendors.json`.

The mode resolves per vendor, because a single default cannot serve both runtimes: it links where the vendor follows an out-of-tree symlink and copies where it does not, and the result row names the mode each vendor got. `--copy` forces a snapshot everywhere; `--link` forces a link and fails a vendor that will not load one, rather than quietly copying when a live link was asked for. Codex and Copilot CLI scan no local directory at all and report as `unsupported`, with their marketplace route named.

Re-running replaces this plugin's own earlier install rather than stacking; a destination another plugin owns is refused until `--force`. `plugin uninstall` applies the same ownership test, and reports a destination that was never installed rather than failing. Both refuse to run against a vendor whose derived manifest was never built, pointing at `plugin build`.

Recorded as ADR-0012, with the verified per-runtime facts and their confidence in `.research/local-marketplaces/`.

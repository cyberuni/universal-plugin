# Changes

## 2026-08-18 — created, corrected against the CLIs, then corrected again

Opened while adding a `marketplace` skill, prompted by a third-party README that publishes install
commands for four runtimes.

**First pass, documentation only.** Concluded that Codex's marketplace commands were uncorroborated
and that this project's Codex catalog path was unsourced.

**Second pass, running the CLIs.** Both conclusions were wrong. `codex plugin marketplace add` and
`codex plugin add` exist in codex-cli 0.147.0; the docs do not cover them. Fixture probes then
suggested Codex reads only `.claude-plugin/marketplace.json`, so `marketplace init --codex` looked
like a defect and was filed as issue #42.

**Third pass, correcting the probe.** The `.agents/plugins` fixture had been named `<name>.json`
while the command writes `marketplace.json`. Codex discovers a catalog by that filename, so the probe
had tested the name and not the directory. With the filename held constant, `.agents/plugins/` is
accepted and installs end to end. E-CODEX-M4 and E-CODEX-M5 are retracted, E-CODEX-M10 and
E-CODEX-M11 replace them, and #42 was closed as invalid.

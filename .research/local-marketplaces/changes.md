# Changes

## 2026-08-18 — created, then corrected against the shipped CLIs

Opened while adding a `marketplace` skill, prompted by a third-party README that publishes install
commands for four runtimes. The first pass checked vendor documentation only. It concluded that
Codex's marketplace commands were uncorroborated and that this project's Codex catalog path was
merely unsourced.

Both conclusions were wrong in different directions, and running the CLIs fixed them. `codex plugin
marketplace add` and `codex plugin add` exist in codex-cli 0.147.0; the docs simply do not cover
them. And the `.agents/plugins/` catalog is not unsourced but unread: Codex rejects a marketplace
root that carries only that file, and accepts `.claude-plugin/marketplace.json`. See E-CODEX-M3
through E-CODEX-M7, all direct observation.

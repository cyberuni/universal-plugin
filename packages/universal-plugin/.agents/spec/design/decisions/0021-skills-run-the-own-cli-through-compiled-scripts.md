# 0021 — Skills run the plugin's own CLI through compiled per-command scripts

**Status:** accepted
**Date:** 2026-11-18
**Builds on:** [0019](./0019-build-compiles-skill-scripts.md) — `plugin build` compiles a declared
entry into one committed, self-contained `.mjs`.
**Narrows:** [0020](./0020-build-writes-plugin-launchers.md) — a launcher stays, as a Claude Code
convenience only.
**Upstream:** [issue #284](https://github.com/cyberuni/universal-plugin/issues/284).

## Context

A skill that runs its plugin's own CLI used `npx -y <pkg>@<version> <command>`. That fetches and runs
code at call time, and a permission rule written for the command never matches it. ADR 0020 answered
with a launcher, `bin/<name>`, which Claude Code puts on the Bash tool's `PATH`. Probes on 2026-11-18
found that no other runtime does:

- **GitHub Copilot CLI 1.0.100:** `copilot plugin install` copies `bin/` into
  `~/.copilot/installed-plugins/`, but a bare `bin/<name>` call fails with `command not found`, and no
  plugin path is on `PATH`.
- **Cursor, cursor-agent 2026.09.28:** with `--plugin-dir` and with `~/.cursor/plugins/local/<name>`,
  the skill loads, but a bare call exits 127, and no plugin path is on `PATH`.

A launcher whose entry is `dist/` also fails in a git-sourced install, which has no `dist/`
([cyber-agentkit#319](https://github.com/cyber-uni/cyber-agentkit/pull/319)).

A compiled script from ADR 0019 needs none of that. It is committed, so a git-sourced install carries
it, and it imports nothing outside Node, so it needs no `dist/`, no `PATH` and no `npx`.

## Decision

1. **One script per command.** For a CLI `cli` with a command `x y`, the plugin declares
   `"skills/<skill>/scripts/cli-x-y.mjs": { "source": "<entry that runs x y>", "command": "x y" }`
   under `extensions["org.cyberuni.universal-plugin"].scripts`, and `plugin build` compiles it. The
   script sits in the skill that calls it, because a skill folder travels on its own (0019).
2. **The skill calls `node <this skill's folder>/scripts/cli-x-y.mjs`.** No hashbang is relied on and
   no executable bit: `node <path>` works on every install route, Windows and a copy that drops the
   file mode included.
3. **No runner fallback beside a built script.** A committed script that `plugin build --check` keeps
   current in CI leaves `npx` or `pnpm exec` nothing to recover. Only a command over the 150 KB budget
   (0019 §4), where the build warns, keeps a pinned `pnpm exec <bin>`, then `npx`.
4. **The doctor finds both cases.** `own-package-runner` (severity `low`) names each `file:line` that
   runs `npx`, `upx` or `pnpm exec` on the plugin's own package for a command the skill has no script
   for. Its repair is the script entry to declare, with the path and command filled in, and the
   `node` call to make. `runner-beside-script` (severity `low`) names each such line for a command
   the same skill already has a script for, and says to drop it. A script over the budget clears that
   line.
5. **The setup is on demand.** The doctor is how an author learns a skill needs one. The
   `init-universal-plugin` change mode has an *add a command script* route that does the setup:
   declare the entry, write the source, build, call it with `node`, drop the fallback. The doctor's
   repair points to that route.
6. **Launchers are Claude Code only.** A launcher stays an optional convenience there. No doc or
   repair recommends it as the way a skill reaches the CLI.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| Set the script up in `plugin init` | `plugin init` runs when the plugin project is created, before the author usually decides to ship a CLI |
| `plugin build` warns on a skill that runs its own package with no script | The build would read skill prose, which is the doctor's job and already done there. It would warn on every build and in CI, including for a command over the budget where the runner is the right call. A build warning also does no setup; the author still needs the route |
| Keep the launcher as the recommended route | It resolves bare only in Claude Code (probes above), and a `dist/` entry fails in a git-sourced install |
| Keep `npx` as a fallback after the script | It fetches code at call time and matches no permission rule, to recover from a missing file that `--check` already keeps from shipping |
| One script per CLI instead of per command | A full CLI is 280 KB to 1.3 MB minified (#177), over the budget; one command is 12 to 100 KB |

# 0022 — Skills run their plugin's CLI through one forwarding script per CLI

**Status:** accepted
**Date:** 2026-11-18
**Builds on:** [0019](./0019-build-compiles-skill-scripts.md) — a script the build writes into a
skill is committed, embeds the plugin version from `plugin.json`, and is reported `missing` or `stale`
by `--check`.
**Supersedes:** [0021](./0021-skills-run-the-own-cli-through-compiled-scripts.md) — compiled
per-command scripts as the route for a plugin's CLI. Its §6, the launcher removal, carries over here
unchanged, and [0020](./0020-build-writes-plugin-launchers.md) stays superseded.
**Upstream:** [issue #287](https://github.com/cyberuni/universal-plugin/issues/287), which supersedes
[#284](https://github.com/cyberuni/universal-plugin/issues/284).

## Context

ADR 0021 had a skill run its plugin's CLI through a compiled script per command. That does not scale
for a CLI that skills use broadly:

- cyber-asana's whole CLI, compiled as one file, is 1.6 MB minified, about 11 times the 150 KB
  budget (0019 §4). Each script must sit inside its skill folder, so its 6 CLI-using skills would
  commit about 10 MB, rewritten every release.
- Splitting per command means one entry per command used. Its skills mention about 73 distinct
  command strings, and any combination the split leaves out fails when the skill runs.

A pinned `npx <pkg>@<version>` in the skill text has the opposite problem. In development it always
runs the published package, so testing a skill exercises the last release's CLI instead of the local
change. A strong model may substitute the local build on its own; a smaller one runs the line as
written. The choice has to be made in code.

## Decision

1. **One thin forwarding script per skill, named after the CLI.** The build writes
   `skills/<skill>/scripts/<cli>.mjs`. It holds none of the CLI's code and forwards every argument, so
   no command can be missed. The skill calls `node <this skill's folder>/scripts/<cli>.mjs <args>`.
   There is no hashbang and no executable bit: `node <path>` works on every install route, on
   Windows, and in a copy that drops the file mode.
2. **The declaration is a `forward` entry in the `scripts` extension.** The output path maps to
   `{ "forward": "<cli>" }`, where `<cli>` is a bin of the `packagePath` `package.json`:
   `"skills/build-plugin/scripts/universal-plugin.mjs": { "forward": "universal-plugin" }`. A CLI from
   another package names the package and pins its version:
   `{ "forward": "cyber-asana", "package": "cyber-asana", "version": "2.1.0" }`. The output's file
   name must be `<cli>.mjs`. A `forward` entry takes no `source`, `command`, `alias` or `keepNames`;
   it is written from a template, not compiled. A `package` that is the plugin's own package is the
   own form, and takes no `version`.
3. **Resolution is chosen by the script, at run time.**
   - **Dev checkout.** Starting from its own real path, the script walks up to the first
     `package.json` whose `name` is the package and whose `bin` has the CLI. It runs that bin with
     `node` only when the checkout can load it: the bin file exists, and so does every file the bin
     names by a literal relative specifier (`import`, `from`, `import()` or `require()`), with or
     without an extension. A skill linked through a symlink resolves to the checkout, because the
     walk starts from the real path.
   - **Why that check** ([issue #298](https://github.com/cyberuni/universal-plugin/issues/298)). A
     git-sourced install (Cursor's git-subdir, Copilot CLI's github source, `skills add`) carries
     `package.json` and the committed bin but not the build output, which is gitignored. The bin is
     the committed file, and the build output is what it imports, so one hop from the bin reaches
     the missing part in every layout seen: repobuddy's `bin/buddy.js` imports `../esm/bin.js`,
     buddy-agent-harness's bin imports `dist/cli.mjs`, and a bin that points into the output itself
     is simply missing. The check reads one file and names no build folder.
   - **A computed import path** ([issue #303](https://github.com/cyberuni/universal-plugin/issues/303)).
     A bin with an `import()` or `require()` whose argument is not a string literal, such as
     ``import(`../${out}/cli.js`)`` or `import(file)`, names no file to check, so a git install and a
     built checkout look the same. The script treats such a bin as one that cannot load and runs
     `npx`. A checkout with that bin therefore runs the published package, so write the import as a
     literal; universal-plugin's own bin does.
   - **Stale warning.** It warns on stderr when the build output is older than the newest file
     under `src/`. The build output is the top folder of the checkout where the first import that
     leaves the bin's own top folder lands, such as `dist/` or `esm/`. With no such import the bin may
     be hand-written, so the script cannot tell and does not warn.
   - **Otherwise** (an installed skill, a copied skill folder, a plugin cache, an unbuilt checkout):
     `npx -y <package>@<version> <args>`.
   - Every argument passes through unchanged, stdio is inherited, and the script exits with the
     CLI's exit code. On Windows, `npx` runs through the shell as `npx.cmd`, with each argument
     quoted.
   - It does not run from source. tsx is unavailable in an install, and Node's type stripping cannot
     resolve `.js` specifiers to `.ts`. Running from source may come later as an opt-in.
4. **The version is stamped, never typed.** The build embeds the package, the bin and the version in
   the same `globalThis.__SKILL_SCRIPT__` header a compiled script carries (0019 §6), with
   `forward: "own"` or `forward: "pinned"`. The own form's version is `plugin.json`'s, never
   `package.json`'s (0019 §7). `plugin version` restamps it like a compiled script's header, and
   `publish check-version` reads it as a `compiled-script` surface. `plugin build --check` reports a
   forwarder `missing`, `stale` or `version` like any other script entry, and fails on one it refuses,
   such as an output not named `<bin>.mjs` ([issue #304](https://github.com/cyberuni/universal-plugin/issues/304)).
   - changesets: `changeset version && universal-plugin plugin version`.
   - semantic-release: `@semantic-release/exec` runs `universal-plugin plugin version
     ${nextRelease.version}` in `prepare`, and `@semantic-release/git` commits the stamped files.
5. **A CLI from another package keeps its pin.** Its version is the entry's. `plugin version` leaves
   it alone, `publish check-version` does not compare it, and a changed pin in `plugin.json` makes
   the written file `stale` until the next build.
6. **The doctor points to the forwarder.** `own-package-runner` (severity `low`) names each `file:line`
   that runs the plugin's own package through `npx`, `upx` or `pnpm exec <bin>` in a skill with no
   forwarder for that CLI. Its repair is the `forward` entry to declare, with the skill's path filled
   in, and the `node` call to make. `runner-beside-forwarder` (severity `low`) replaces
   `runner-beside-script`: it names each such line in a skill that already has a forwarder for the
   same CLI, and says to call the forwarder instead.
7. **The setup is on demand.** `init-universal-plugin`'s change mode has an *add a CLI forwarder*
   route: declare the entry, build, and rewrite the skill's runner lines to the `node` call. It
   replaces 0021's *add a command script* route, and the doctor's repair points to it.
8. **Launchers stay removed** (0021 §6). A leftover `launchers` key warns, never reaches a derived
   manifest, and writes nothing.

Compiled scripts (0019) still cover a script that stands alone, such as `doctor` or `rewrite-upx`.
They are no longer the route for running a plugin's CLI.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| Compiled per-command scripts (0021) | A broadly used CLI is far over the budget in full, and a per-command split misses any command it leaves out |
| A pinned `npx <pkg>@<version>` in skill text | In development it runs the last release, so testing a skill exercises the wrong CLI; the model, not code, decides whether to substitute the local build |
| `@<version>` placeholders in skill text | A placeholder is a line the model must rewrite before running it |
| Run the checkout and fall back to npx on `ERR_MODULE_NOT_FOUND` | Telling a startup failure from one inside the CLI needs its stderr piped, which takes the terminal away from the CLI, and a later failure would run the command twice |
| Look for a known build folder (`dist/`, `esm/`) | Every package names its output differently; the bin's own imports name it without a list |
| Run a bin with a computed import as a checkout (the first cut of this ADR) | On a git install it crashes on the missing build output (issue #303); npx is always safe, and a literal import gets the checkout back |
| Have `plugin build` warn on a bin with a computed import | The run-time fall-through already makes every install safe; a warning would repeat what the docs say without changing what runs |
| Follow the bin's imports recursively | The gap is always the first hop, from the committed bin into the ignored output; a deeper walk costs a parse per file on every call |
| Run from source in the dev checkout | tsx is unavailable in an install, and Node's type stripping cannot resolve `.js` specifiers to `.ts` |
| A separate `forwarders` key | The `scripts` map already owns every file the build writes into a skill, with its `--check`, stamp and drift rules; a second key would repeat all three |
| Look up the CLI with `pnpm exec` before `npx` | pnpm links only direct dependencies, and the lookup spawns a process on every call; the dev walk finds a checkout without one |
| Bring launchers back | They resolve bare only in Claude Code (0021) |

---
title: Running your CLI from skills
description: How a skill runs its plugin's CLI with one command line that works on every install route and in development, through a forwarding script per CLI.
---

A plugin that ships a CLI usually has skills that run it. This page shows how to write that call so it
works wherever the skill ends up, and why the other ways fall short.

## The problem

A skill's command line has to work on every route the skill travels:

- an npm install, where the package sits in `node_modules`;
- a git-sourced install (Cursor's git-subdir, Copilot CLI's github source), which has no build output;
- a skill folder pnpm links or copies on its own, and a plugin cache that keeps only what the plugin
  ships;
- your own checkout, where you test the skill against the change you just made.

It also has to be one line every model runs as written. A strong model may notice it is in a checkout
and swap in the local build. A smaller one runs exactly what the skill says. The choice of which CLI
to run belongs in code, not in the model's judgment.

## The approach

Each skill that runs the CLI gets one small forwarding script, named after the CLI, and calls it with
`node`:

```sh
node <this skill's folder>/scripts/<cli-name>.mjs <args>
```

The forwarder holds none of the CLI's code. It passes every argument, stdio and the exit code through,
so no command can be missed. It picks the CLI each time it runs:

```text
scripts/<cli-name>.mjs
  │ walk up from its own real path
  ├─ a package.json whose name is the package and whose bin has the CLI,
  │  and the bin and every file it imports by a relative path exist?
  │    yes → node <that checkout>/<bin> <args>     (warns when the output is older than src/)
  │    no  ↓
  └─ npx -y <package>@<version> <args>            (version written in by plugin build)
```

The first rung is your checkout. A skill linked through a symlink resolves to it too, because the walk
starts from the real path. The second rung covers every install.

A git-sourced install has your `package.json` and bin but no build output, because the output is
gitignored. So the forwarder runs the checkout only when the bin can load. The bin file has to exist,
and so does every file it names by a literal relative path, such as `import '../esm/cli.js'` or
`require('../dist/cli')`. Otherwise it falls through to `npx`. Write that import as a literal: a bin
that builds the path at run time cannot be checked, so it runs as a checkout even when the output is
missing.

The stale warning compares `src/` with the folder that import lands in, such as `dist/` or `esm/`.
When the bin imports nothing outside its own folder, the forwarder cannot tell where the output is, so
it does not warn. The forwarder never runs your
TypeScript source: tsx is not there in an install, and Node's type stripping cannot resolve `.js`
specifiers to `.ts`.

## Setup

1. Declare a forwarder in each skill that runs the CLI, under
   `extensions["org.cyberuni.universal-plugin"].scripts` in `plugin.json`. `<bin>` is a bin of the
   `package.json` at `packagePath`, and the file is named after it:

   ```json
   "scripts": {
     "skills/tasks/scripts/tasks.mjs": { "forward": "tasks" }
   }
   ```

   For a CLI another package ships, name the package and pin its version:
   `{ "forward": "other-cli", "package": "other-pkg", "version": "2.1.0" }`.

2. Run `plugin build` and commit the forwarder it writes. In CI, `plugin build --check` exits 1 when
   one is missing, stale or on another version. See
   [Running the plugin's own CLI from a skill](../../cli/build/#running-the-plugins-own-cli-from-a-skill)
   for every rule the build applies.

3. Rewrite each runner line in the skill to the `node` call above, with the same command and
   arguments. Write no fallback beside it and no `@<version>`.

[`doctor-universal-plugin`](../../skills/doctor-universal-plugin/) finds the lines to rewrite:
`own-package-runner` for a skill that runs your package through `npx`, `upx` or `pnpm exec` with no
forwarder, and `runner-beside-forwarder` for one that has a forwarder and still keeps the runner line.
The *add a CLI forwarder* route of [`init-universal-plugin`](../../skills/init-universal-plugin/) does
the setup for you.

## Versions

The forwarder's version comes from `plugin.json`, never `package.json`, and `plugin version` restamps
it with every other place the version lives. Wire that into your release:

- **changesets:** `changeset version && universal-plugin plugin version`.
- **semantic-release:** `@semantic-release/exec` runs
  `universal-plugin plugin version ${nextRelease.version}` in `prepare`, and `@semantic-release/git`
  commits the stamped files, `skills/**` included. The
  [full config](../../skills/init-universal-plugin/#releasing-with-semantic-release) is on the
  `init-universal-plugin` page.

`publish check-version` compares the forwarder's version with the rest. A forwarder for another
package keeps the version its entry pins: no stamp moves it and no drift check compares it.

## Why not the alternatives

- **A bare `npx <pkg>@<version>` in the skill:** in your checkout it runs the published CLI, so testing
  the skill exercises the last release, not your change
  ([ADR 0022](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/design/decisions/0022-skills-run-the-own-cli-through-a-forwarding-script.md)).
- **The CLI compiled into the skill:** a broadly used CLI is far over the 150 KB budget (cyber-asana's
  is 1.6 MB minified), and splitting it per command misses any command the split leaves out
  ([ADR 0021](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/design/decisions/0021-skills-run-the-own-cli-through-compiled-scripts.md),
  superseded).
- **A `bin/<name>` launcher:** only Claude Code puts a plugin's `bin/` on `PATH`; Cursor and Copilot
  CLI do not
  ([ADR 0020](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/design/decisions/0020-build-writes-plugin-launchers.md),
  superseded).

For CLIs a skill runs that are not the plugin's own, and the cost of each runner word, see
[Choosing a runner](../npx-and-upx/).

---
title: Choosing a runner
description: Which runner word a skill should shell out through — npx, upx, a bundled launcher, or no runner at all — and what each choice costs.
---

Skills invoke CLIs by shelling out. The runner word at the front of that command decides how much
each call costs, how reproducible it is, and what has to be installed before the skill works at all.
This page records how to choose one.

`npx <pkg>@<version>` re-resolves and re-spawns on every call — even when the package is already
cached — and it never reuses a global install.
[`upx`](https://repobuddy.github.io/upx) is a local-first alternative: it resolves a semver **range**
against installs that already exist and spawns the binary directly, falling back to `npx` on a miss.
Measured against a warm `npx` on npm 12, that is roughly **3× faster per call**
([method and numbers](https://repobuddy.github.io/upx/concepts/measurements/) — re-run them before
quoting them, since the gap narrows as npm gets faster).

`upx`'s own documentation carries the resolution algorithm and the failure modes that belong to the
runner. What follows is what the choice means **for a plugin**.

## Cache contention under parallelism

The npx install cache (`~/.npm/_npx`) is shared process-wide and is not concurrency-safe. When
several tasks shell out to the same uncached `npx <pkg>@<version>` at once — parallel CI jobs,
or several agents working at the same time — the concurrent installs race to populate the same
directory and fail with `ENOTEMPTY`. The symptom is not a clean error: a validation step reports
that it "did not run", intermittently, on some runs only.

Two mitigations were used in practice, in escalating order:

1. **Warm the cache serially** before the parallel work, so the concurrent calls all hit a populated
   cache. This narrows the window; it does not close it.
2. **Remove the subprocess.** Where the CLI also ships a programmatic API, importing it in-process
   removes the resolution, the spawn, and the cache entirely. This is the only complete fix, and it
   is available only when the tool exposes a library entry point.

## What adopting `upx` costs a plugin

`upx` is a latency fix, not a correctness fix.

### It trades reproducibility for speed, by design

`plugin bundle` pins skills to an **exact** version at release. Adopting `upx` deliberately widens
that pin to a caret range (`^<major>`, or `^0.<minor>` for a 0.x package). The version a skill runs
is then whatever satisfying copy happens to be nearest — which may not be the version the skill was
written and tested against. A stale global install that still satisfies the range wins silently.
`npx <pkg>@<exact>` cannot do this.

### It is not ambient, so it needs a bootstrap

`npx` ships with npm; it is on every machine that has Node. `upx` only exists after
`npm i -g @repobuddy/upx`. A skill whose command word is `upx` will fail with `command not found`
anywhere that install has not happened.

This matters most for **non-npm plugin distribution**. A plugin installed from a git source drops
skill files into a consuming repo that depends on nothing — a bare `upx` there is exactly the
"requires a global install" failure that pinned `npx <pkg>@<version>` was adopted to avoid. Keep
`npx` as the runner word for skills that must work on a cold machine.

### The fallback path still has npx's problems

A `upx` miss runs `npx`. On a cold cache with parallel callers, the cache race is unchanged — it just
happens less often, because hits skip it. If the goal is to eliminate the race rather than make it
rarer, the answer is still to import the library in-process.

### Two runner words to maintain

The corpus now contains both forms, and tooling has to recognize both and preserve whichever a
reference already uses. Detection is textual — a `<runner> <pkg>@<version>` pattern in Markdown — so
it depends on the reference carrying an explicit `@<version>`. Bootstrap idioms such as
`npx skills add <repo> --skill <name>` are untouched only because they carry no version, and
non-workspace packages are skipped on a separate axis. This is a heuristic boundary, not a declared
one; treat a rewrite tool's output as something to review rather than trust.

## Running a CLI your own plugin ships

The fastest call is the one with no runner word at all. When the CLI belongs to the plugin shipping
the skill, the code is already on disk next to the skill, and the skill can import it directly.

Ship a launcher in the skill's own `scripts/` directory, named for the command it runs:

```js
#!/usr/bin/env node
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// <package>/skills/<skill>/scripts/doctor.mjs: four levels up is the package root.
const packageRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))))

process.argv.splice(2, 0, 'doctor')
await import(join(packageRoot, 'bin', 'my-cli.mjs'))
```

The skill body names it relative to itself:

```sh
node scripts/doctor.mjs
```

Four things make this work, and each fails a different way if you skip it.

**Resolve from `import.meta.url`, never the working directory.** An agent runs the script from the
repository it is working on, so the working directory is that repository rather than the skill. That
is what you want for the command's input. It is useless for finding the command.

**Keep `node` in front.** A launcher written by a build step ships as mode `100644`, so its shebang
never runs it, and on Windows a shebang does nothing regardless of mode.

**Publish the plugin to npm if the CLI has dependencies.** An npm-sourced install brings the
dependency tree; a git source copies the repository and leaves `node_modules` to whatever the
checkout happened to contain. The launcher then fails on a missing transitive dependency rather than
on anything you wrote. See the caveat in [Tradeoffs](#it-is-not-ambient-so-it-needs-a-bootstrap),
which is the same distribution boundary from the other side.

**Keep a pinned `npx` fallback in the body.** Resolving the script's path is model behavior, not a
guarantee, and a git-sourced install has no dependency tree. One line covers both.

Pin the fallback to the version that shipped the skill, and regenerate it at release. A skill states
the flags and output of its own version, so an unpinned fallback can hand an agent a CLI its
documentation does not describe. Generating the skill text and running that generator inside
`changeset version`, alongside `publish sync-version`, keeps the pin from going stale behind the
package.

## Choosing a runner

| Situation | Use |
| --- | --- |
| The CLI ships in the same plugin as the skill | A launcher in the skill's `scripts/`, run as `node scripts/<name>.mjs` |
| The CLI exposes a library API and you control the call site | Import in-process — no runner at all |
| A skill shipped to unknown machines, or via a non-npm plugin source | `npx <pkg>@<exact>` |
| A skill called many times per run, on a machine you set up | `upx <pkg>@^<major>` |
| A dist-tag (`@latest`, `@next`) | `npx` — `upx` cannot match a tag |
| A declared dependency in your own package scripts | `node_modules/.bin`, via your package manager |

## Related

- [`@repobuddy/upx`](https://github.com/repobuddy/upx) — the runner itself: measurements, the
  resolution algorithm, and its own failure modes
- [Installation](/universal-plugin/getting-started/installation/) — installing `upx`
- The `adopt-upx` skill rewrites `npx <pkg>@<version>` references to `upx <pkg>@^<major>`
- The `upgrade-plugin` skill bumps pins for both runner words, preserving each reference's
  existing word

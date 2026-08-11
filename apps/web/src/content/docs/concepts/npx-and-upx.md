---
title: npx and upx
description: Why skills that shell out to a CLI pay a real cost under npx, what upx changes, and the tradeoffs upx introduces.
---

Skills invoke CLIs by shelling out. The runner word at the front of that command — `npx` or `upx` —
decides how much each call costs, how reproducible it is, and what has to be installed before the
skill works at all. This page records why `upx` exists and where it is the wrong choice.

## The three costs of `npx`

### Per-call latency

`npx <pkg>@<version>` re-resolves and re-spawns on every invocation, roughly **1s**, even when the
package is already in the npx cache. A skill that calls a CLI a few dozen times per run spends most
of its wall clock in the runner.

Measured against `gherkin-cli`, three runs each:

| Path | Time | Speedup |
| --- | --- | --- |
| `npx <cli>@<version>` | ~1.0s | 1× |
| `pnpm exec <cli>` | ~0.4s | 2.5× |
| `npx --no-install` (cached) | ~0.25s | 4× |
| local-first resolver shim | ~0.10s | 10× |
| direct `node_modules/.bin/<cli>` | ~0.05s | 20× |
| node cold-start floor | ~0.02s | — |

`pnpm exec` is a dead end — the 0.4s is package-manager startup, and it only works where the package
is a declared dependency. The direct `.bin` path is fast but hardcodes a single location and a
single version.

### Cache contention under parallelism

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

### No reuse of a global install

`npx` never uses a globally installed copy. A machine can have the exact version already on disk and
still pay the full resolution cost. Pinning an exact version into every consuming project instead
fragments `node_modules` across near-identical copies.

## What `upx` changes

`upx <pkg>@<range>` resolves the requested **semver range** against installs that already exist and
spawns the binary directly, at roughly 0.10s:

1. Walk `node_modules` from the current directory up through its ancestors — the **nearest**
   satisfying install wins.
2. Otherwise use a satisfying install under `npm root -g`.
3. Otherwise fall back to `npx <pkg>@<range>`, passing the spec through exactly as given, and print a
   one-line notice to stderr.

It is a transparent exec wrapper: the child owns stdout, stderr, and the exit code. It installs
nothing.

Matching a **range** rather than a version is the point — one global install serves every caller
pinned to that major, which is what makes a single `npm i -g universal-plugin` pay off across a whole
corpus of skills.

## Tradeoffs

`upx` is a latency fix. It is not a correctness fix, and it introduces its own failure modes.

### It trades reproducibility for speed, by design

`plugin bundle` pins skills to an **exact** version at release. Adopting `upx` deliberately widens
that pin to a caret range (`^<major>`, or `^0.<minor>` for a 0.x package). The version a skill runs
is then whatever satisfying copy happens to be nearest — which may not be the version the skill was
written and tested against. A stale global install that still satisfies the range wins silently.
`npx <pkg>@<exact>` cannot do this.

### Resolution depends on ambient state

The result of the same command varies with the current working directory (a package subdirectory and
the repo root can resolve to different installs) and with whatever is installed globally on that
machine. Nothing in the plugin declares or creates that global install. Agents change directories
mid-run, so two calls in one skill run can legitimately resolve to two different versions.

The fallback notice is a single stderr line, which in an agent transcript is easy to miss — the
common failure is not an error, it is running the wrong version quietly.

### It is not ambient, so it needs a bootstrap

`npx` ships with npm; it is on every machine that has Node. `upx` is a second bin of
`universal-plugin` and only exists after a global install. A skill whose command word is `upx` will
fail with `command not found` anywhere that install has not happened.

This matters most for **non-npm plugin distribution**. A plugin installed from a git source drops
skill files into a consuming repo that has no dependency on `universal-plugin` at all — a bare `upx`
there is exactly the "requires a global install" failure that pinned `npx <pkg>@<version>` was
adopted to avoid. Keep `npx` as the runner word for skills that must work on a cold machine.

### The fallback path still has npx's problems

A `upx` miss runs `npx`. On a cold cache with parallel callers, the cache race is unchanged — it just
happens less often, because hits skip it. If the goal is to eliminate the race rather than make it
rarer, the answer is still to import the library in-process.

### Dist-tags never get faster

`@latest` and `@next` name a moving target, so they cannot be matched against an installed
`package.json` version. Those references always fall through to `npx` and pay `upx`'s own startup on
top. Use a semver range, or leave the reference on `npx`.

### An added bin can break a working call

`upx` refuses to guess among several binaries. It resolves a string `bin`, an object entry keyed by
the package's unscoped name, or a single-entry object — anything else is a fail-loud error. A
dependency that adds a second bin in a patch release can therefore turn a working `upx pkg@^1` call
into a hard failure without any change on the calling side.

### Two runner words to maintain

The corpus now contains both forms, and tooling has to recognize both and preserve whichever a
reference already uses. Detection is textual — a `<runner> <pkg>@<version>` pattern in Markdown — so
it depends on the reference carrying an explicit `@<version>`. Bootstrap idioms such as
`npx skills add <repo> --skill <name>` are untouched only because they carry no version, and
non-workspace packages are skipped on a separate axis. This is a heuristic boundary, not a declared
one; treat a rewrite tool's output as something to review rather than trust.

## Choosing a runner

| Situation | Use |
| --- | --- |
| The CLI exposes a library API and you control the call site | Import in-process — no runner at all |
| A skill shipped to unknown machines, or via a non-npm plugin source | `npx <pkg>@<exact>` |
| A skill called many times per run, on a machine you set up | `upx <pkg>@^<major>` |
| A dist-tag (`@latest`, `@next`) | `npx` — `upx` cannot match a tag |
| A declared dependency in your own package scripts | `node_modules/.bin`, via your package manager |

## Related

- [Installation](/universal-plugin/getting-started/installation/) — installing the `upx` bin
- The `adopt-upx` skill rewrites `npx <pkg>@<version>` references to `upx <pkg>@^<major>`
- The `upgrade-universal-plugin` skill bumps pins for both runner words, preserving each reference's
  existing word

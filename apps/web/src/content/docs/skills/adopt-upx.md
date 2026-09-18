---
title: adopt-upx
description: Rewrite npx <pkg>@<version> references in your skills to a caret range on the upx runner.
---

Rewrites `npx <pkg>@<version>` references inside `SKILL.md` files to a caret range on `upx` — the
fast local-first runner shipped as [`@repobuddy/upx`](https://github.com/repobuddy/upx). This is an
opt-in migration, not a default: see [Choosing a runner](../../concepts/npx-and-upx/) for when `npx`
is still the right choice.

## The rewrite rule

`npx <pkg>@<version>` → `upx <pkg>@^<major>` — a caret range, not the exact pin. One global `upx`
install then satisfies every skill's call to that CLI at that major, instead of `npx` re-resolving
and respawning per exact version every time.

A `0.x` pin is special: under semver a `0.x` minor bump is breaking, so it rewrites to
`upx <pkg>@^0.<minor>` (e.g. `pkg@0.2.3` → `upx pkg@^0.2`) rather than the far-too-loose `^0`.

Left alone: non-semver doc placeholders, dist-tags (`@next`, `@latest`), references already on
`upx`, and any skill marked `pin-exempt: true` in its frontmatter.

## Scope

Pass a single skill's path, a named set of paths and/or globs, or `--all` to rewrite every
`SKILL.md` in the project. The rewrite runs through a script rather than hand-editing, and is
idempotent — running it again over already-rewritten files is a no-op.

## The tradeoff

A skill rewritten to `upx` depends on the `upx` bin being on that environment's PATH. `npx` always
ships with npm; `upx` only exists after `npm i -g @repobuddy/upx`. `upx` itself falls back to plain
`npx` on a version miss, but only once the shell has found the `upx` bin in the first place — if it
isn't on PATH at all, the shell fails before that fallback ever runs. The skill says this out loud
before rewriting anything broadly.

## See also

- [Choosing a runner](../../concepts/npx-and-upx/) — the npx/upx tradeoff in full
- [`upgrade-plugin`](../upgrade-plugin/) — bumps the version half of a pin; this skill only changes the runner word

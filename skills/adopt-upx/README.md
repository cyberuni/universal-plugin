# adopt-upx skill

Rewrites `npx <pkg>@<version>` references in `SKILL.md` files to `upx <pkg>@^<major>` — the fast
local-first runner shipped by `universal-plugin`.

## When to use

When you want a project's skills to call CLIs via `upx` instead of `npx`, for the ~10× speed win
on repeated invocations (local-first resolution vs. `npx`'s ~1s registry+spawn cost per call, even
cached).

## What it does

1. Confirms `upx` is installed (`npm i -g universal-plugin`) and on PATH.
2. Rewrites `npx <pkg>@<concrete-semver>` → `upx <pkg>@^<major>` across a chosen scope:
   - one specific skill (a path)
   - a named set (a list of paths and/or globs)
   - every skill in the project (`--all`)
3. Leaves non-semver placeholders (`@<version>`), dist-tags (`@next`), already-`upx` references,
   and any `pin-exempt: true` skill untouched.
4. Reports a per-file rewrite count and a final tally. Safe to re-run (idempotent).

## Mechanism

`scripts/rewrite-upx.mjs` — a standalone Node script, no dependencies. See `SKILL.md` for usage.

## Tradeoff

A rewritten skill depends on `upx` being on PATH. `npx` ships with every npm install; `upx` only
exists after `npm i -g universal-plugin`. This is an opt-in migration, not a safe default.

## Install

```bash
npx skills add cyberuni/universal-plugin --skill adopt-upx
```

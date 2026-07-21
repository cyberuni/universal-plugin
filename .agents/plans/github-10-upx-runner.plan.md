---
cr-ref: github-10
project: universal-plugin
project-path: packages/universal-plugin
source: https://github.com/cyberuni/universal-plugin/issues/10
status: draft
todos:
  - content: "Reshape issue #10: kill packer premise, record benchmark + upx-runner design"
    status: completed
  - content: "Spec new node run/: upx lean bin — drafted; round-3 cold spec-judge running"
    status: in_progress
  - content: "Spec revise plugin/bundle: ADDITIVE --runner scenarios drafted (default PRESERVES ref runner); README+root updated"
    status: in_progress
  - content: "Spec setup skill (escaped side-work): rewrite npx->upx across a specific / set / all skills"
    status: pending
  - content: "Spec gate: freeze run.feature + additive bundle scenarios; self-assert/ratify"
    status: pending
  - content: "Deliver: upx bin impl + bundle --runner flag + setup skill"
    status: pending
  - content: "Deliver escaped side-work: docs recommend upx; upgrade-universal-plugin skill recognize upx"
    status: pending
  - content: "Impl gate + handoff (PR, Closes #10)"
    status: pending
---

# github-10 — upx local-first runner

CR against `packages/universal-plugin` + escaped monorepo side-work (docs, skills).
Source: issue #10.

## Problem

`npx <cli>@<version>` costs ~1s/call (registry resolve + spawn), even when cached. Skills that
shell out to CLIs (gherkin-cli, cyberlegion, universal-plugin itself) pay this per call — dozens of
times per mission.

## Measured latency (gherkin-cli, 3 runs each)

| Path | Time | Speedup |
|---|---|---|
| `npx <cli>@<version>` (today) | ~1.0s | 1× |
| `pnpm exec <cli>` | ~0.4s | 2.5× (PM startup — dead end) |
| `npx --no-install` (cached) | ~0.25s | 4× |
| **node resolver shim** (local-first + npx fallback) | ~0.10s | **10×** |
| direct `node_modules/.bin/<cli>` | ~0.05s | 20× (fragile path, single version) |
| node cold-start floor | ~0.02s | — |

## Design (SETTLED in-session)

A **local-first runner** named `upx`, realizing the resolver-shim idea as a productized tool:

1. **`upx` bin — NEW `run/` node in universal-plugin.** Shipped as a **lean standalone bin** (NOT a
   subcommand of the full CLI — full-CLI startup would erode the 10× win). `upx <pkg>@<range> <args>`:
   find a **local then global** install whose version satisfies `<range>` → spawn its binary directly
   (~0.10s), transparent stdio/exit passthrough; on a miss → fall back to `npx <pkg>@<range>` (slow,
   one-time). Range-based, so one global install serves many callers across versions.
2. **Setup skill (escaped side-work, `skills/`)** — rewrites `npx <pkg>@<version>` → `upx <pkg>@^<major>`
   across a **specific skill / a named set / all skills**; installs `universal-plugin` globally.
3. **`plugin bundle` — ADDITIVE `--runner upx` flag** (default stays `npx`). Emits the `upx <pkg>@<exact>`
   form only when opted in. New scenarios only → NO frozen-scenario rewrite, NO re-open.

### Naming

`upx` bin command is safe. npm package `upx` = the UPX **executable packer** (unrelated), but only
**126 downloads/week** (~100× rarer than niche tools), and it's a build-dep, rarely global — global
bin collision is near-zero. We ship `upx` as a **bin of `universal-plugin`**, not a package named
`upx` (that name is taken; bin name ≠ package name, so fine).

### Superseded (do NOT implement)

- ~~upx = an off-the-shelf npm runner~~ — no such tool exists; the npm `upx` is the packer.
- ~~`plugin bundle --runner npx/upx` swapping the runner word on exact pins~~ — earlier framing; the
  runner is a real resolver bin, not a word swap. bundle emits the `upx` form.

## Runner semantics (pinned round 2, post spec-judge)

- **Local discovery:** cwd-anchored ancestor `node_modules` walk; nearest satisfying wins.
- **Global discovery:** `npm root -g`; used when no local satisfies. Tie-break: nearest-local → global → npx.
- **Grammar:** split package spec on last `@` at index > 0 (scoped-safe); no `@` = bare (any version).
  Empty/malformed name → fail-loud. Range present but NOT valid semver (e.g. `pkg@next`) → treat as a
  **dist-tag → npx fallback** (can't semver-match a tag locally).
- **Bin derivation:** string bin; or object keyed by unscoped pkg name; or single-entry object → resolve.
  Multi-bin with no name match, or no bin field → **fail-loud** (never guess).
- **Fallback notice:** ALWAYS on, stderr, fixed prefix `upx: no installed <pkg> satisfies "<range>", using npx`.
- **Auto-install on miss:** NO — pure npx fallback, writes nothing to node_modules/global.
- **Arg boundary:** flag = token starting `-`; upx flags parsed only before the first non-flag token
  (the package spec); unknown leading flag → fail-loud; everything after the spec → child verbatim.
- **Test harness (observability):** spec-owned FIXTURE packages whose bins print a marker + a shim `npx`
  on PATH printing its own marker; scenarios assert the marker (which path ran), never "spawned directly".
- **Charter:** runner stays in universal-plugin (bundle already emits its refs; kept a separate lean bin) —
  rationale RECORDED in root spec.md placement map.

## Spec-judge history

- Round 1 (Fable, cold): ALIGNED false — oracle/builder/architect all FAIL, 7 gaps. Resolved in round 2
  by the semantics above. Re-judging.

## NEXT

Apply round-2 rewrite to run/README.md + run.feature + root spec.md charter note; re-dispatch cold
spec-judge. On ALIGNED → spec gate (freeze run.feature). Then additive bundle `--runner upx` scenarios.

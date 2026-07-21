---
cr: github-12
source: https://github.com/cyberuni/universal-plugin/issues/12
project: universal-plugin
project-path: packages/universal-plugin
todos:
  - content: "explore: draft additive dist-tag-notice scenario on run/ + branch distTagNotice impl"
    status: pending
  - content: "spec gate: cold spec-judge on run.feature diff; verify additive (gherkin-cli diff); freeze self-clears"
    status: pending
  - content: "deliver: impl distTagNotice, pnpm verify, impl gate (cold impl-judge)"
    status: pending
  - content: "escaped skill work: fix adopt-upx 0.x range -> ^0.<minor> in rewrite-upx.mjs + SKILL.md; commit separately"
    status: pending
  - content: "handoff: rebase, PR closing #12, record any follow-ups, nudge formation"
    status: pending
---

# CR github-12 — refine upx dist-tag notice + adopt-upx 0.x range

Two refinements from mission github-10 (issue #12). **Mixed CR.**

## NEXT
Explore item 2 (the tracked CR): add one additive scenario to
`packages/universal-plugin/.agents/spec/run/run.feature` locking that the dist-tag miss
notice does NOT say "satisfies", then branch `distTagNotice()` in `src/run/run.ts`.

## Scope

- **Item 2 (SDD CR, node `run/`):** dist-tag miss notice currently reads
  `upx: no installed <pkg> satisfies "<tag>", using npx` — "satisfies" is wrong for a tag.
  Fix: split `distTagNotice(pkg, tag)` off `fallbackNotice(pkg, range)` in `run.ts`; the
  fallback path picks per `isSemverRange(range)`. Lock via ONE additive scenario (new, not a
  modify → freeze self-clears, no re-open). Range-miss keeps "satisfies"; bare miss unchanged.
- **Item 1 (escaped skill work, `skills/adopt-upx/`):** repo-root skill, outside the project
  spec → escapes SDD lifecycle. `rewrite-upx.mjs` rewrites every semver to `^<major>`, so a
  `0.x` pin becomes loose `^0` (>=0.0.0 <1.0.0). Fix: `0.x` → `^0.<minor>`; keep `^<major>`
  for `>=1.0.0`. Update SKILL.md "Rewrite rule" prose. Committed separately.

CR link: https://github.com/cyberuni/universal-plugin/issues/12

---
cr-ref: github-15
project: universal-plugin
project-path: packages/universal-plugin
source: https://github.com/cyberuni/universal-plugin/issues/15
status: draft
todos:
  - content: "Ratified re-open + Clearance pre-authorized: fold two 'upx tool-a@next' scenarios in run.feature into one"
    status: in_progress
  - content: "Spec gate: verify merged scenario preserves union of assertions; re-freeze; self-assert"
    status: pending
  - content: "Deliver: no code change (unit tests already cover both behaviors); confirm pnpm test green"
    status: pending
  - content: "Impl gate + handoff (PR, Closes #15)"
    status: pending
---

# github-15 — fold the two dist-tag `upx tool-a@next` scenarios

CR against `packages/universal-plugin`, node `run/`. Source: issue #15 (a github-12 backlog follow-up).

**Revise, frozen-suite re-open.** Merge the two scenarios in `run/run.feature` sharing the trigger
`upx tool-a@next` (dist-tag→npx routing + dist-tag miss-notice wording) into one scenario asserting the
**union** of their `Then` steps. Behavior-preserving, cosmetic — no `upx` code change; unit tests
`run.test.ts` already verify both behaviors independently.

**Freeze:** feature-level `@frozen`. Folding rewrites/deletes frozen scenarios → re-open. User
**ratified the re-open** and **pre-authorized the Clearance floor** in-session (2026-07-21).

## NEXT

Edit `run.feature`: replace the two same-trigger scenarios with one merged scenario carrying all four
unique `Then` assertions (NPX-SHIM routing, `no installed tool-a` prefix, `dist-tag`, not `satisfies`).
Confirm edit-class with gherkin-cli diff, run `pnpm test`, self-assert both gates, PR `Closes #15`.

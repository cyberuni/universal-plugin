---
cr-ref: github-25
project: universal-plugin
project-path: packages/universal-plugin
source: https://github.com/cyberuni/universal-plugin/issues/25
status: active
todos:
  - content: "Intake #25 and record the local-only marketplace-init scope"
    status: completed
  - content: "Author marketplace/init use cases, CFG, and mapped acceptance suite"
    status: completed
  - content: "Run the spec gate and record the #25 contract verdict"
    status: completed
  - content: "Verify the implementation against the frozen #25 contract"
    status: in_progress
  - content: "Run the impl gate and hand off #25"
    status: pending
---

# github-25 — repository-local marketplace initializer

Source: [GitHub issue #25](https://github.com/cyberuni/universal-plugin/issues/25).

## Scope

`universal-plugin marketplace init` discovers allowlisted root-level plugin manifests and derives
local Claude, Codex, and Copilot catalogs; Cursor is an explicit local submission scaffold. The
command must never publish, register, install, authenticate, provision, or call marketplace APIs.

## Re-open record

The implementation and an initial `marketplace/init` README + feature already exist, but this CR had
no plan or gate record and the suite was marked `@frozen` before the mission loop. The user directed
this session to redo the spec. Author the contract from the issue's product intent — use cases first,
then the CFG, then the one-to-one scenario map and suite. Inspect the existing implementation only
afterward as a conformance check. No behavior is intentionally removed.

## NEXT

Spec gate passed provisionally: the cold judge aligned Oracle, Builder, and Architect; the 37-scenario
suite is frozen. Gherkin parse, referenced-artifact/use-case coverage, root-state, and concept-index
checks pass. The isolated `check-suite` dependency is unavailable; its availability is recorded in
the gate rationale.

Resolved decision (user-confirmed): #25's root-level `plugin.json` is a marketplace metadata
manifest, independent of the canonical `.plugin/plugin.json` agent-plugin manifest. A repository may
carry both. Keep #25 discovery on the top-level marketplace manifest and state the distinction in its
contract.

Deliver against the frozen contract. Known implementation gaps: recursive manifest discovery accepts
nested manifests, selected writes are not an atomic set, and neither read nor write symlink containment
is enforced. Add per-scenario verification before the impl gate.

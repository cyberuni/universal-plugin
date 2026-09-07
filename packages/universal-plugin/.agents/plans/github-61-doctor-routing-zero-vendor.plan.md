---
status: active
cr: github-61
source: https://github.com/cyberuni/universal-plugin/issues/61
project: universal-plugin
project-path: packages/universal-plugin
todos:
  - content: "Explore: decide the zero-vendor exit question against the AXI contract"
    status: completed
  - content: "Spec: add legacy-layout scenarios to plugin/build node + README"
    status: completed
  - content: "Spec gate: judge build.feature diff (additive only, freeze preserved)"
    status: completed
  - content: "Deliver: legacy-layout detection + structured error in src/build"
    status: completed
  - content: "Deliver: rewrite skills/doctor/SKILL.md description for layout/upgrade routing"
    status: completed
  - content: "Impl gate: verify each new frozen scenario"
    status: completed
  - content: "Handoff: changeset, PR closing #61"
    status: completed
---

# github-61 — doctor routing + the zero-vendor build result

A repo left on the pre-0.6 layout (`.plugin/plugin.json`, top-level `vendorExtensions`) makes
`plugin build` derive nothing and still report success. Two defects:

1. **Routing.** `doctor`'s `description` triggers are absence/staleness shaped. Here the manifests
   exist and the build is green, so nothing matches. The reporter found the skill by grepping.
2. **Silence.** `built 0` on an unreadable layout is reported as a definitive empty state.

## Decision — the zero-vendor exit question

Split by cause, per the AXI contract (`.agents/spec/axi/README.md` #5 vs #6):

- A **canonical** manifest that genuinely declares no harnesses is an empty *result* → stays exit 0
  (AXI #5, and the frozen scenario "no targets declared is a definitive empty state" is preserved).
  It gains a next-step line pointing at `doctor` (AXI #9).
- A **pre-0.6 layout** the CLI cannot read is a failed *read*, not an empty result → exit 1 with a
  structured error naming the signal found and pointing at `doctor` (AXI #6).

Signals scoped to the two unambiguous ones from the field report: a top-level `vendorExtensions` key
in the root manifest, and a `.plugin/plugin.json` that shadows root. A merely minimal manifest with
no extensions block is left on the exit-0 path.

This keeps the change **additive** to the frozen suite — a distinct precondition, not a narrowing —
so no freeze re-open and no Clearance stop.

## Follow-ups recorded (not filed here)

- **architect** — the pre-0.6 signal set is asserted in both the `plugin/build` node and the `doctor`
  finding table with no shared home; a third marker would need both updated.
- **strategist** — no shipped skill carries a spec node (ADR-0009 treats skills as reach artifacts).
  This CR changed routing text outside any gate; whether that should stay ungated is a doctrine call.

## Out of scope

Issue #62 (Copilot CLI field loss during adoption, `skills/init/`) — worked in parallel elsewhere.

## NEXT

Landed. Both defects are fixed on branch `cyberlegion/unit-2021bb4f488d6acc`: the zero-vendor result
is split by cause in `src/build`, and `doctor`'s description routes on the symptom. Spec gate and
impl gate both approved by cold judges; four scenarios added to `plugin/build`, nothing narrowed.
Nothing remains to resume — the two follow-ups above are recorded in the ledger, not carried here.

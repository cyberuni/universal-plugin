---
cr: github-23
status: draft
todos:
  - content: "Write new ADR revising ADR-0001 boundary — add repository/project init & setup as 3rd concern (inbound/outbound reasoning)"
    status: completed
  - content: "Revise root spec.md — capability map + placement map + why + by-concept gain the init/setup concern"
    status: in_progress
  - content: "Explore+spec the EXPANDED plugin/init/ node (behavioral, AXI): reopen+widen its frozen spec.md + init.feature to cover both facets; no new node (ADR-0005)"
    status: pending
  - content: "Explore+spec the gateway skill node (skill artifact-type): interactive harness-select orchestrator"
    status: pending
  - content: "Spec gate: freeze touched .feature(s), record ledger gate line, set status approved"
    status: pending
  - content: "Deliver facet 1 — repo-level .agents/skills + relative harness symlinks (copy fallback) + per-repo harness record"
    status: pending
  - content: "Deliver facet 2 — npm-package-as-plugin: .plugin/plugin.json + package.json files ship built .claude-plugin/plugin.json"
    status: pending
  - content: "Deliver dogfood — make packages/universal-plugin itself a plugin (skills/init/SKILL.md + own .plugin/plugin.json)"
    status: pending
  - content: "Impl gate: pnpm verify green on rebased tree; plugin build derives clean; per-scenario verification"
    status: pending
  - content: "Handoff — PR referencing Closes #23, combat log, distilled summary"
    status: pending
---

# github-23 — repository/project init & setup for universal-plugin

CR: https://github.com/cyberuni/universal-plugin/issues/23
Settled design: [github-23-init-setup.design.md](./github-23-init-setup.design.md)

Charter-expanding CR. Adds a **third** universal-plugin concern (repo/project init & setup) beside
the `plugin` group and `governance`. Two facets: (1) repo-level canonical `.agents/` + harness
compatibility; (2) an npm package can ship an agentic plugin. Plus an interactive gateway skill and
dogfooding this package as a plugin. Marketplace/publish stays out (cyberplace).

## Resolved decisions (this mission)

- **Expand `plugin/init/`, no new node (ADR-0005, revises ADR-0001).** `plugin init` is spec-only
  (unimplemented), so repository/project init & setup is specced **onto it** — not a parallel `init/`
  node. Concern count stays **two** (`plugin` group + `governance`); `plugin init`'s charter widens.
  This *deviates* from the design doc, which left placement open, and *narrows* #23's "third concern"
  framing to "expanded plugin init." (User steer, this session.)
- **Three-way boundary (ADR-0005).** author / consume / distribute: `plugin init` = authoring-side
  repo/project setup; **`repobuddy` = consuming-project setup (out of scope here)**; `cyberplace` =
  distribution/runtime. `repobuddy` surfaced while scoping #23 — deviates from the design doc's
  two-way split. Every other design-doc decision (both-facets scope, symlink mechanics, npm source,
  gateway skill) stands.
- **Root `spec.md` flipped `status: implemented → draft`** — normative content under revision by
  github-23; the spec gate (todo 5) re-approves and re-stamps the approval block (currently records
  github-8 history). Capability map, Why, and placement map already updated to the expanded
  `plugin/init/` (by-concept unaffected — plugin/init/ already carries `canonical-manifest`; regen if
  its `concept:` set changes at node-spec time).

## NEXT

Charter change landed (ADR-0005 + root spec: two concerns, `plugin init` expanded). Continue:

1. Reopen and widen the frozen **`plugin/init/`** node — its `spec.md` + `init.feature` — to cover
   both facets (repo-level `.agents/skills/` + per-harness wiring; npm-package-as-plugin), plus the
   gateway skill node. Adopt the settled design doc as the draft; do not re-grill settled decisions
   (symlink mechanics, npm source, both-facets scope). Grill only the open spec/scenario details.
2. Open questions still to resolve in that grill: is facet-2's `package.json` wiring one `plugin init`
   run or a distinct flag/verb; per-harness detection heuristics (which config dirs signal
   "installed"); how the expanded contract stays back-compatible with the existing frozen scenarios.

**Open, carry forward:** #24 (merged #21) shipped Codex prompt emission *unchanged* — still writes
`~/.codex/prompts/<skill>.md`, which Codex ≥0.117.0 no longer reads (root cause of cyberplace#431).
Facet-1's Codex discoverability/verification must not certify against that dead path; revisit whether
to file a follow-up trimming #24's Codex target to skill-only.

Open questions to resolve in explore (see design doc §Open):
- Exact node placement: a top-level `init/` capability vs a sub-node — decide capability-first.
- Whether facet-2's package.json wiring is part of `init` or a distinct verb.
- How `init` and the existing frozen `plugin init` relate (name collision avoidance).

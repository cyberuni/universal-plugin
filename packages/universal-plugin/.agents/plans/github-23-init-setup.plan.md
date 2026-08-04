---
cr: github-23
status: draft
todos:
  - content: "Write new ADR revising ADR-0001 boundary — add repository/project init & setup as 3rd concern (inbound/outbound reasoning)"
    status: pending
  - content: "Revise root spec.md — capability map + placement map + why + by-concept gain the init/setup concern"
    status: pending
  - content: "Explore+spec the init/ CLI node (behavioral, AXI): grill spec.md + init.feature; place capability-first"
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

## NEXT

Start explore with the **charter change first** — it unblocks node placement:

1. Draft the new ADR (`.agents/spec/design/decisions/0005-*.md`) revising ADR-0001's boundary to admit
   repository/project init & setup; keep marketplace/install out. Then revise root `spec.md`.
2. Then run the grill loop on the `init/` CLI node (behavioral, AXI-exercising) and the gateway skill
   node. Adopt the settled design doc as the draft — do not re-grill the decisions already made
   (placement rationale, symlink mechanics, npm source, both-facets scope); grill only the open
   spec/scenario details.

Open questions to resolve in explore (see design doc §Open):
- Exact node placement: a top-level `init/` capability vs a sub-node — decide capability-first.
- Whether facet-2's package.json wiring is part of `init` or a distinct verb.
- How `init` and the existing frozen `plugin init` relate (name collision avoidance).

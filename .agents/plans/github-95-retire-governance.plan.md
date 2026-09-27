---
cr-ref: github-95
project: universal-plugin
project-path: packages/universal-plugin
source: https://github.com/cyberuni/universal-plugin/issues/95
status: active
todos:
  - content: "Intake: fetch #95, locate spec, check buddy-agent-harness release, scaffold plan"
    status: completed
  - content: "Explore: governance/ node -> deprecation contract; build node drops copies + --check; ADR-0017; root map"
    status: pending
  - content: "Spec gate: cold spec-judge; Clearance floor pre-authorized by the CR; freeze"
    status: pending
  - content: "Deliver: governance stub, delete copy step + --check, governances/ -> references/, skills + docs"
    status: pending
  - content: "Impl gate: cold impl-judge; pnpm verify green; rebase onto main"
    status: pending
  - content: "Handoff: changeset, PR (Closes #95), hold merge until buddy-agent-harness release publishes"
    status: pending
---

# github-95 — retire the governance command and the build copy step

CR: https://github.com/cyberuni/universal-plugin/issues/95 (I4 of repobuddy/buddy-agent-harness#152).

- Replacement: `buddy-agent-harness reference show` (#153) and the `load-reference` skill (#154).
  Both merged; not on npm at intake (latest 0.12.0; release PR repobuddy/buddy-agent-harness#151 open).
- Plugin tier of `reference`: `<dep>/references/` of each declared (dev)dependency. Ship
  `references/` at the package root.
- Cyberplace readers (`skill-design` lookup order, cyberspace skills) are cyberplace's work.

## NEXT

Explore: rewrite `governance/` README + feature to the deprecation contract.

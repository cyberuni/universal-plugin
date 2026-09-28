---
cr-ref: github-95
project: universal-plugin
project-path: packages/universal-plugin
source: https://github.com/cyberuni/universal-plugin/issues/95
status: active
todos:
  - content: "Intake: fetch #95, locate spec, check buddy-agent-harness release, scaffold plan"
    status: completed
  - content: "Explore: governance/ node -> retirement contract; build node drops copies + --check; ADR-0017; root map"
    status: completed
  - content: "Spec gate: 4 cold spec-judge rounds (3 correction rounds); Clearance pre-authorized by the CR; frozen"
    status: completed
  - content: "Deliver: governance shim, copy step + --check deleted, governances/ -> references/, skills + docs"
    status: completed
  - content: "Impl gate: cold impl-judge approve 11/11; package + root verify green on main"
    status: completed
  - content: "Handoff: changeset, PR (Closes #95); merge held until buddy-agent-harness release publishes"
    status: completed
---

# github-95 — retire the governance command and the build copy step

CR: https://github.com/cyberuni/universal-plugin/issues/95 (I4 of repobuddy/buddy-agent-harness#152).

- Replacement: `buddy-agent-harness reference show` (#153) and the `load-reference` skill (#154).
  Both merged; not on npm at intake (latest 0.12.0; release PR repobuddy/buddy-agent-harness#151 open).
- Plugin tier of `reference`: `<dep>/references/` of each declared (dev)dependency. Ship
  `references/` at the package root.
- Cyberplace readers (`skill-design` lookup order, cyberspace skills) are cyberplace's work.

## NEXT

Landed as a PR (Closes #95); spec status implemented. Merge waits on the owner and on the
buddy-agent-harness release carrying `reference` and `load-reference` reaching npm. Follow-ups are in
the ledger shard.

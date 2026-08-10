# Lessons Learned

## SDD lifecycle must be executed, not merely read

**Pattern:** Implemented and opened a PR for a new SDD behavioral capability after reading
`start-mission`, but skipped its spec-producer → spec-judge → impl-producer → impl-judge → handoff
workflow and marked the BDD suite frozen without the required gate.

**Rule:** For every SDD change request, invoke and carry out `start-mission` before implementation.
Do not write `@frozen`, mark a spec approved/implemented, open a PR, or claim completion until its
required producer, judge, gate, ledger, and handoff steps have been completed and evidenced.

**Context:** Any behavioral change to a project with an SDD project spec, including a task supplied
with a prewritten implementation plan.

**Category:** `architecture`

## Verify the mission identifier before resuming

**Pattern:** Resumed the first stale plan that looked active instead of the issue explicitly named by
the user, #25.

**Rule:** When resuming SDD work, take the user-supplied issue/CR identifier as authoritative. Confirm
the matching plan before reading or acting on any other plan; if it is absent, scaffold that exact
plan rather than inferring a substitute from stale todo states.

**Context:** Repositories with several retained `.agents/plans/*.plan.md` files.

**Category:** `workflow`

## Do not backfill when asked to author a spec

**Pattern:** Treated existing #25 code as the source for re-deriving the contract after the user
asked to redo the spec.

**Rule:** For a request to author or redo an SDD spec, derive use cases from the stated product intent,
then derive the CFG and scenario map. Inspect implementation only after the contract is authored, as a
conformance check; use a backfill flow only when the user explicitly requests one.

**Context:** SDD missions where implementation exists before a valid contract.

**Category:** `architecture`

## Do not import a neighboring model into an independent capability

**Pattern:** Treated the project’s canonical `.plugin/plugin.json` as the required manifest for the
#25 marketplace initializer, despite the issue’s independent top-level marketplace manifest.

**Rule:** Resolve terminology within the capability’s stated purpose before applying a project-wide
model. When two artifacts may coexist, state their boundary explicitly instead of silently collapsing
one into the other.

**Context:** Repository tools that operate beside, rather than on, canonical agent-plugin metadata.

**Category:** `architecture`

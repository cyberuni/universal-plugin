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

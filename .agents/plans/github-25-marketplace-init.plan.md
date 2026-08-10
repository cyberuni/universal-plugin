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

The user re-opened the selected-write branch after the first spec gate: selected artifacts are each
written atomically, and a later write error is reported with non-zero exit rather than a claimed
cross-artifact rollback. A fresh cold review passed all three lenses and the suite is re-frozen.
Finish implementation conformance and run the impl gate.

Resolved decision (user-confirmed): #25's root-level `plugin.json` is a marketplace metadata
manifest, independent of the canonical `.plugin/plugin.json` agent-plugin manifest. A repository may
carry both. Keep #25 discovery on the top-level marketplace manifest and state the distinction in its
contract.

Implementation now bounds discovery to direct-child non-vendor plugin directories and applies
containment checks to scan roots, plugin roots, manifests, output parents, and output files. It keeps
the user-directed best-effort selected-write behavior. Add any targeted coverage the impl gate needs;
do not touch the unrelated `.agents/cyberlegion/` worktree content.

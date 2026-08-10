---
cr: github-23
status: draft
todos:
  - content: "Write new ADR revising ADR-0001 boundary — add repository/project init & setup as 3rd concern (inbound/outbound reasoning)"
    status: completed
  - content: "ADR-0006 — adopt Agent Plugins Spec v1.0.0 canonical (root plugin.json + skills/; closed fields; extensions namespace; derive per-harness, no symlinks). Rebase ADR-0005 mechanics onto it"
    status: completed
  - content: "Revise root spec.md — canonical/why/capability/placement maps move to root plugin.json + skills/ + extensions model (ADR-0006); flip to draft"
    status: in_progress
  - content: "PHASE 1 migration: schema/v1.json rewrite (closed manifest + org.cyberuni.universal-plugin extensions shape); drop WIP top-level 'agents' key"
    status: pending
  - content: "PHASE 1 migration: retarget build/validate/bundle/publish-sync-version/cli + fixtures/tests from .plugin/plugin.json -> plugin.json; vendorExtensions -> extensions[com.<vendor>]; vendors -> extensions[org.cyberuni.universal-plugin].vendors"
    status: pending
  - content: "PHASE 1 migration: docs/examples/governances sweep off .plugin/ + .agents/skills/; pnpm verify green"
    status: pending
  - content: "PHASE 2 explore+spec the EXPANDED plugin/init/ node on new layout: scaffold root plugin.json + skills/; npm packaging; no symlinks (ADR-0005 rebased by ADR-0006)"
    status: pending
  - content: "PHASE 2 explore+spec the gateway skill node (skill artifact-type): interactive harness-select orchestrator"
    status: pending
  - content: "Spec gate: freeze touched .feature(s), record ledger gate line, set status approved"
    status: pending
  - content: "Deliver facet 1 — init scaffolds root plugin.json + skills/; build derives <harness>/plugin.json (distinct content); per-repo harness record in extensions"
    status: pending
  - content: "Deliver facet 2 — npm-package-as-plugin: package.json files[] ship the built <harness>/plugin.json (e.g. .claude-plugin/plugin.json)"
    status: pending
  - content: "Deliver dogfood — make packages/universal-plugin itself a plugin (skills/init/SKILL.md + own root plugin.json)"
    status: pending
  - content: "Impl gate: pnpm verify green; plugin build derives clean; per-scenario verification"
    status: pending
  - content: "Handoff — PR referencing Closes #23 (+ split PHASE 1 into its own PR if desired), combat log, distilled summary"
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

- **Adopt Agent Plugins Spec v1.0.0 as canonical (ADR-0006, revises ADR-0001).** Root `plugin.json`
  (not `.plugin/plugin.json`) + `skills/` (not `.agents/skills/`) + `mcp.json`. Manifest field set is
  **closed** (`additionalProperties:false`) — no sibling keys. All tool config moves under
  `extensions`: `extensions["org.cyberuni.universal-plugin"].vendors` (was top-level `vendors`) and
  `extensions["com.<vendor>"]` (was `vendorExtensions.<vendor>`). Namespace `org.cyberuni.universal-plugin`
  confirmed by user. `schema/v1.json` is **rewritten**, not patched. The WIP top-level `"agents":"./agents/"`
  key is a closed-schema violation — **drop it**.
- **Derive per-harness, never symlink (ADR-0006).** Runtimes mostly don't read root `plugin.json`; they
  keep their own paths (`.claude-plugin/plugin.json`, …) with **different content**. So `plugin build`
  derives one `<harness>/plugin.json` per vendor (each on that harness's own schema); different content
  ⇒ symlinks impossible. This **supersedes ADR-0005's Facet-1 symlink model** — no `.agents/skills/`,
  no link step.
- **CR structure:** canonical migration is a distinct concern but lands on **this branch** as its own
  commit series (PHASE 1) ahead of the init widening (PHASE 2); one-concern-per-commit; splittable to
  its own PR at handoff. (User did not opt for a separate issue; proceeding on-branch for momentum.)
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

Design record reframed on spec adoption: ADR-0006 (adopt canonical) + ADR-0005 (rebased) committed.
Root `spec.md` revision to the new layout is the live todo (`in_progress`). Then **PHASE 1 migration**
before any init work:

1. Finish root `spec.md`: move canonical/why/capability/placement framing to root `plugin.json` +
   `skills/` + `extensions` (ADR-0006). Commit as the design-record unit.
2. **PHASE 1 — canonical migration (its own commit series):**
   a. Rewrite `schema/v1.json` — closed spec manifest + `org.cyberuni.universal-plugin` extensions
      shape; drop the WIP `"agents"` key.
   b. Retarget source (`build`/`validate`/`bundle`/`publish sync-version`/`cli`) + fixtures/tests:
      `.plugin/plugin.json` → `plugin.json`; `vendorExtensions` → `extensions["com.<vendor>"]`;
      `vendors` → `extensions["org.cyberuni.universal-plugin"].vendors`. ~57 files — mechanical bulk,
      delegable once the schema contract is locked; keep `pnpm verify` green per commit.
   c. Sweep docs/examples/governances off `.plugin/` and `.agents/skills/`.
3. **PHASE 2 — init widening** on the migrated layout (see todos). Open questions still live: facet-2
   `package.json files[]` as one `plugin init` run vs a flag; per-harness detection heuristics;
   back-compat with the frozen `init.feature` manifest scenarios.

**Carry-forward:** #24 (merged #21) still emits `~/.codex/prompts/<skill>.md` (Codex ≥0.117 ignores it,
cyberplace#431); revisit under PHASE 2 facet-1 discoverability.

**Open, carry forward:** #24 (merged #21) shipped Codex prompt emission *unchanged* — still writes
`~/.codex/prompts/<skill>.md`, which Codex ≥0.117.0 no longer reads (root cause of cyberplace#431).
Facet-1's Codex discoverability/verification must not certify against that dead path; revisit whether
to file a follow-up trimming #24's Codex target to skill-only.

Open questions to resolve in explore (see design doc §Open):
- Exact node placement: a top-level `init/` capability vs a sub-node — decide capability-first.
- Whether facet-2's package.json wiring is part of `init` or a distinct verb.
- How `init` and the existing frozen `plugin init` relate (name collision avoidance).

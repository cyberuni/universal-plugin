---
cr: github-23
status: draft
todos:
  - content: "Reconcile design record with unit-198195: adopt their ADR-0005 (init/setup concern) + ADR-0006 (narrow to publish; shared-object rule; consume→buddy-agent-harness); renumber spec-adoption to ADR-0007; amend ADR-0001"
    status: completed
  - content: "ADR-0007 — adopt Agent Plugins Spec v1.0.0 canonical (root plugin.json + skills/; closed fields; extensions namespace; derive per-harness, no symlinks)"
    status: completed
  - content: "Re-derive plugin/init node (README use-case→CFG→scenario map + init.feature) on new canonical, incl. `plugin init --npm` publish half; check-suite green"
    status: completed
  - content: "Reconcile root spec.md: their two-concern + shared-object-rule base, re-applied on the new canonical (root plugin.json + skills/ + extensions); keep status draft"
    status: completed
  - content: "PHASE 1 migration: schema/v1.json rewrite (closed manifest + org.cyberuni.universal-plugin extensions shape); drop WIP top-level 'agents' key"
    status: completed
  - content: "PHASE 1 migration: retarget build/validate/bundle/publish-sync-version/cli + fixtures/tests from .plugin/plugin.json -> plugin.json; vendorExtensions -> extensions[org.cyberuni.universal-plugin].harnesses; vendors -> extensions[org.cyberuni.universal-plugin].vendors"
    status: completed
  - content: "PHASE 1 migration: docs/examples/governances sweep off .plugin/ + .agents/skills/; pnpm verify green"
    status: completed
  - content: "Spec gate: freeze touched .feature(s), record ledger gate line (Clearance fires — init.feature rewritten off .plugin/), set status approved"
    status: pending
  - content: "Deliver `plugin init --npm` (publish half only) on the new canonical: write root plugin.json + wire package.json files[] with derived <harness>/plugin.json paths + skills/"
    status: pending
  - content: "Impl gate: pnpm verify green; plugin build derives clean; per-scenario verification"
    status: pending
  - content: "Handoff — PR referencing Closes #23 (+ split PHASE 1 into its own PR if desired), combat log, distilled summary"
    status: pending
---

# github-23 — repository/project init & setup for universal-plugin

CR: https://github.com/cyberuni/universal-plugin/issues/23
Settled design: [github-23-init-setup.design.md](./github-23-init-setup.design.md)

CR scope (post-reconciliation): add **`plugin init --npm`** — the publish half of repository/project
setup (wire an npm package so its built plugin manifests ship) — on the **new spec canonical**. The
*consume* half (harness `.agents/skills` wiring, gateway skill, enabled-harness record) is **out**:
it moves to `repobuddy/buddy-agent-harness` (ADR-0006). Concern count stays two (`plugin` group +
`governance`). Marketplace/publish stays out (cyberplace).

## Resolved decisions (this mission)

- **Reconciled with parallel unit `cyberlegion/unit-19819526420fb47f` (pod-23).** It reached a sharper
  scoping conclusion independently; adopted its two ADRs and retired mine:
  - **ADR-0005 (theirs)** — repository/project init & setup as a concern (origin + the invalid
    inbound/outbound-as-placement lesson).
  - **ADR-0006 (theirs)** — narrow to the **publish half**; the **shared-object rule** (a concern
    belongs here only if its object is the canonical manifest or this CLI's own config); the consume
    half → **`repobuddy/buddy-agent-harness`** (`bd harness init`, config at
    `.agents/buddy-agent-harness/config.json`).
  - **ADR-0007 (mine, renumbered)** — adopt Agent Plugins Spec v1.0.0 canonical; retargets their
    `--npm` publish scenarios onto the new layout.
- **Adopt Agent Plugins Spec v1.0.0 as canonical (ADR-0007, revises ADR-0001).** Root `plugin.json`
  (not `.plugin/plugin.json`) + `skills/` (not `.agents/skills/`) + `mcp.json`. Manifest field set is
  **closed** (`additionalProperties:false`). All tool config under `extensions`:
  `extensions["org.cyberuni.universal-plugin"].vendors` (was `vendors`) and
  `extensions["org.cyberuni.universal-plugin"].harnesses.<vendor>` (was `vendorExtensions.<vendor>`).
  `schema/v1.json` **rewritten**, not patched. WIP top-level `"agents"` key is a closed-schema
  violation — **drop it**.
- **Schema locked & committed (this session) — `474c8c2`.** User-reviewed shape, three decisions
  settled at the gate:
  - **All `universal-plugin` config nests under the one namespace we own,
    `extensions["org.cyberuni.universal-plugin"]`** — component paths, `vendors`, `packagePath`, and
    per-harness overrides. **Amends ADR-0007 §Decision 2** (`1219f9d`): originally per-harness data
    was to scatter into `com.<vendor>` reverse-domain namespaces; reopened because runtimes never read
    the canonical (`universal-plugin` derives every per-harness manifest), so those blocks are our own
    build inputs and `com.*` would mint reverse domains we don't own.
  - **Per-harness overrides key = `harnesses.<vendor>`** (user preferred `harnesses` over reusing
    `vendorExtensions`). Real, used feature — pass-through of each harness's native marketplace fields
    (Cursor `publisher`/`logo`, Codex `interface`/`apps`, Claude Code `displayName`/`defaultEnabled`);
    `plugin build` copies each block verbatim into the derived manifest.
  - **`$schema` is a required const** = `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`
    (spec-strict, user choice). Editors validate the spec base only; `universal-plugin`'s own validate
    uses `schema/v1.json` internally. `schema/v1.json` is a published/editor contract — **no code
    consumes it** (build uses a hand-rolled `validateManifest`).
- **Derive per-harness, never symlink (ADR-0007).** Runtimes mostly don't read root `plugin.json`; they
  keep their own paths with **different content**, so `plugin build` derives one `<harness>/plugin.json`
  per vendor — different content ⇒ no symlinks. `plugin init --npm` wires those derived paths into
  `package.json` `files`.
- **Scope = publish half only.** github-23 delivers `plugin init --npm` on the new canonical. The
  consume half (harness wiring, gateway skill, dogfood-gateway, enabled-harness record) leaves to
  `repobuddy/buddy-agent-harness`.
- **`plugin/init/` node re-derived to spec-format bar** — README (What / Use Cases / Control Flow CFG /
  Scenario map) + `init.feature` on the new canonical, `--npm` included, `check-suite` green. The
  rewrite (`.plugin/plugin.json`→`plugin.json`) is **not additive** — it **unfreezes** the suite and
  **fires Clearance** at the spec gate (expected; the reopened contract was never implemented).
- **CR structure:** on **this branch**, one-concern-per-commit (design record → migration → node);
  splittable to its own PR at handoff. (User did not opt for a separate issue.)

## NEXT

**PHASE 1 code + docs migration landed (7 commits, `pnpm verify` 300/300 green):**
`1219f9d` ADR-0007 amend · `474c8c2` schema lock · `2e934a4` source layer (build/bundle/sync-version
read root `plugin.json` + org namespace; derivation re-assembled) · `2a46892` repo manifest → root
`plugin.json`, `.plugin/plugin.json` deleted · `9ebfa8f` 13 examples + template · `6aa5754` living-docs
sweep (skill docs, READMEs, apps/web, governances/plugin-design.md).

**Two design decisions surfaced during PHASE 1 — RESOLVED with the user (apply at the spec gate + impl):**

1. **copilot-cli derives to `.github/plugin/plugin.json`** (user-confirmed). The old
   `VENDOR_OUTPUT['copilot-cli'] = 'plugin.json'` collided with the canonical (now root `plugin.json`).
   Copilot CLI searches root, `.plugin/`, and `.github/plugin/` (research E51); `.github/plugin/
   plugin.json` is a searched, GitHub-idiomatic path with no collision. The canonical's nested
   `extensions` shape is NOT directly Copilot-consumable (Copilot wants top-level component keys +
   camelCase hooks), so a distinct derived file is required — reuse-the-canonical was rejected.
   → change `build.ts` `VENDOR_OUTPUT['copilot-cli']` and `vendor-registry` `pluginRootSuffix`; update
   `build.feature` output-path scenario.

2. **Build targets = `vendors ?? Object.keys(harnesses)`** (user-confirmed). `build` honors the
   `vendors` list; when absent, falls back to all `harnesses` keys (back-compat: figma & other
   harnesses-only examples still build). Makes `init --vendor` (which writes `vendors`) actually control
   the build; keeps the swept prose accurate. → change `build.ts` target selection; update `build.feature`
   selection scenarios; init-node delivery relies on this.

**Next action — SDD spec node + the two resolved behavior changes (spec gate, todo #8).**
`.agents/spec/plugin/{build,validate,bundle}/*.feature` + READMEs + `glossary.md` + `spec.md` still say
`.plugin/plugin.json` (init node already re-derived). Rewrite them off the old canonical AND fold in the
two resolved decisions above (build.feature: copilot output path `.github/plugin/plugin.json`; target
selection `vendors ?? harnesses keys`). This **unfreezes the suites and fires Clearance** — run through
spec-gate (freeze touched features, ledger gate line, status), not a blind sweep. Then apply the matching
`build.ts` + `vendor-registry` code changes and verify at the impl gate.

- **Scope call (open):** `docs/specs/universal-plugin/` is a *legacy backfill* tree (not the active
  spec, unreferenced) — recommend **leave as historical**; confirm with user.
- **Untracked WIP still present:** `agents/agentskills-specialist.md` (harmless; not referenced by any
  manifest) and local `.claude/`. Left in place; not carried into any commit.

Then: deliver `plugin init --npm` (a NEW command — none ships today; spec-first/impl-deferred per the
init README) → impl gate → handoff (PR, Closes #23; PHASE 1 is splittable to its own PR).

### Session landmarks (this branch, do not redo — see commits)
- Design record: ADR-0005/0006 (adopted from unit-198195), ADR-0007 (adopt spec canonical), ADR-0001
  amended; RFC-0001 (enterprise marketplace lockdown). See `design/decisions/` + `design/rfcs/`.
- `spec.md` reconciled to publish-only scope on the new canonical (`status: draft`).
- `plugin/init/` node re-derived to the spec-format bar (What/Use Cases/CFG/Scenario map) + `--npm` +
  verified distribution caveat; `check-suite` green.
- Do **not** relearn the method or relitigate settled ground — see `## Resolved decisions`.

**Handoff to record:** the consume half + the **verified harness registry** (5 rows vs vendor docs,
Windsurf corrected; recoverable from unit-198195 at commit `bdc0f51`) migrate to
`repobuddy/buddy-agent-harness`.

**Carry-forward:** #24 (merged #21) still emits `~/.codex/prompts/<skill>.md`, which Codex ≥0.117.0 no
longer reads (root cause of cyberplace#431). Not this CR's scope now (consume-side), but flag it for
buddy-agent-harness.

**RFC-0001 (open):** `design/rfcs/0001-distribution-under-enterprise-marketplace-lockdown.md` — `--npm`'s
npm plugin source is unusable for org-distributed marketplaces; when enterprises allowlist marketplaces
(lockdown), enterprise users lose the personal-add escape hatch. Options: track upstream / emit
git-subdir/relative-path layout / fall back to `npx`/`upx` runtime invocation (reuses `run/` + `bundle`).
Not this CR — captured for a future decision.

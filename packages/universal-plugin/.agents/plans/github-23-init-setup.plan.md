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
  - content: "Spec gate: rewrite build/validate/bundle .feature + READMEs + glossary + spec.md off .plugin/plugin.json -> root plugin.json; fold resolved build decisions into build.feature (copilot output .github/plugin/plugin.json; targets = vendors ?? harnesses keys); freeze touched .feature(s), record ledger gate line (Clearance fires), set status approved"
    status: completed
  - content: "Impl: apply resolved build decisions in code — build.ts VENDOR_OUTPUT['copilot-cli'] = '.github/plugin/plugin.json' + vendor-registry pluginRootSuffix; build.ts target selection = vendors ?? Object.keys(harnesses); pnpm verify green"
    status: completed
  - content: "Spec gate for plugin/init: freeze init.feature (re-derived on the new canonical in todo #3 but left UNFROZEN; the todo-#3 rewrite broke the backfill-era freeze). Take it Draft→Approved via spec-gate before delivering its impl."
    status: completed
  - content: "Deliver `plugin init --npm` (publish half only) on the new canonical: write root plugin.json + wire package.json files[] with derived <harness>/plugin.json paths + skills/"
    status: completed
  - content: "Impl gate: pnpm verify green; plugin build derives clean; per-scenario verification"
    status: completed
  - content: "Handoff — PR referencing Closes #23 (+ split PHASE 1 into its own PR if desired), combat log, distilled summary"
    status: completed
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

## NEXT — resume here

**MISSION COMPLETE.** All todos done; PR open: **https://github.com/cyberuni/universal-plugin/pull/28**
(`Closes #23`, single PR for the whole branch — user chose not to split PHASE 1). Branch
`github-23-init-setup` pushed to `origin`, 28 commits ahead of `main`. Nothing to resume unless PR
review returns changes. Buddy-agent-harness handoff notes (record, don't build) are at the bottom of
this file: the consume half + verified 5-row harness registry (unit-198195 `bdc0f51`), and
carry-forward #24 (Codex ≥0.117.0 no longer reads `~/.codex/prompts/`).

---

**LANDED this session (2 units, both committed, `pnpm verify` 303/303 green):**
- **Spec gate — build/validate/bundle (todo #8, commit `b7c2ec5`).** Migrated onto the ADR-0007
  canonical (root `plugin.json`; `extensions["org.cyberuni.universal-plugin"].{harnesses,vendors,
  packagePath}`); two build decisions folded into `build.feature`; Clearance fired + user-ratified;
  cold sdd-spec-judge ALIGNED true (R2, `packagePath`-strip gap fixed); ledger gate line
  (`ledger/github-23.7a9e50.jsonl`); the three `.feature` files `@frozen`; root `spec.md`
  `status: approved`.
- **Build-decisions impl (todo #9, commit `54bc109`).** `build.ts` now: copilot-cli →
  `.github/plugin/plugin.json` (+ `vendor-registry` `pluginRootSuffix`); target selection =
  `vendors ?? Object.keys(harnesses)`; eager validation scoped to the selected targets (a non-target
  codex block no longer blocks). +3 tests, strip test strengthened.

**LANDED — the full delivery is done; only HANDOFF remains.**
- **plugin/init spec gate** (`22fd53f`) — `init.feature` `@frozen`, 24 scenarios on the new canonical
  (incl. `--npm` publish half + the no-`--vendor` key-absent default). Cold spec-judge ALIGNED true (R2).
- **plugin init impl** (`7d4e905`) — `src/init/` (pure `init.ts` + `InitFs` `fs.ts` + AXI `cli.ts`),
  registered in the plugin group; reuses build's exported `VENDOR_OUTPUT`. +18 tests.
- **Impl gate** (ledger `impl` line) — cold sdd-impl-judge **IMPLEMENTATION_PASS true**: all 24 init
  scenarios re-derived independently against the real binary; the two build decisions e2e-verified
  (copilot → `.github/plugin/plugin.json`, canonical untouched; `vendors ?? harnesses` selection with
  target-scoped validation). Clean architecture confirmed. `pnpm verify` 321/321. Self-asserted (by
  agent); root `spec.md` stays `approved` (validate/bundle impl-deferred — no root→implemented).

**Next action — HANDOFF (todo #13). Outward-facing: confirm with the user before pushing / opening the PR.**
1. Push `github-23-init-setup`; open a PR **`Closes #23`**. Summarize: the ADR-0007 canonical migration
   (build/validate/bundle + init frozen), the two build decisions, and the new `plugin init --npm`
   command. Note `validate`/`bundle` remain impl-deferred (frozen contracts only).
2. **PHASE 1 split (optional, per plan).** PHASE 1 (schema lock, source layer, repo manifest → root,
   examples, living-docs sweep) is splittable into its own PR — offer it.
3. Distilled summary + combat log. **Handoff to buddy-agent-harness** (record, don't build): the consume
   half + the verified 5-row harness registry (recoverable from unit-198195 `bdc0f51`); carry-forward
   #24 (`~/.codex/prompts/<skill>.md` no longer read by Codex ≥0.117.0).

**Commits this branch (github-23), in order:** `b7c2ec5` spec gate build/validate/bundle · `54bc109`
build impl · `22fd53f` init spec gate · `7d4e905` init impl · (+ interleaved `docs(plan)` checkpoints).

**Tooling note (spec-gate scripts).** `check-suite.mts` / `classify-edit-class.mts` import `gherkin-cli`.
gherkin-cli@0.2.0 is installed **globally** but ESM won't resolve it from the SDD skill dir; symlink the
global into (or `npm i gherkin-cli@0.2.0` beside) `<spec-gate>/scripts/node_modules` to run those two.

**`validate`/`bundle` impls remain spec-first / impl-deferred** — their frozen contracts are migrated;
no code owes them this CR beyond what already ships.

**Open scope call (decide before/at handoff):** `docs/specs/universal-plugin/` is a *legacy backfill*
tree (not the active spec, unreferenced anywhere living) — recommend **leave as historical**; unconfirmed.

**Then:** deliver `plugin init --npm` — a NEW command (none ships today; spec-first/impl-deferred per the
init README) — → impl gate → handoff (PR, Closes #23; PHASE 1 is splittable to its own PR).

**Findings the diff won't show:**
- `schema/v1.json` is a published/editor contract only — **no code consumes it** (build uses a hand-rolled
  `validateManifest`), so the schema lock landed standalone and green.
- `build.ts` re-assembles each derived manifest as *metadata + component paths + that harness's block*,
  excluding `$schema`/`extensions`/`vendors`/`packagePath` — chosen to preserve prior output (skills path
  still lands in the derived manifest) per the `build.test.ts:writes vendor manifests` assertion.
- `.plugin/pins.json` (bundle artifact) is intentionally **kept** — only the manifest left `.plugin/`.
- Untracked, intentionally not committed: `agents/agentskills-specialist.md` (harmless WIP, referenced by
  no manifest) and local `.claude/`.
- Do **not** relearn the method or relitigate settled ground — see `## Resolved decisions`.

**PHASE 1 landed this session (9 commits, `pnpm verify` 300/300 green):** `1219f9d` ADR-0007 amend ·
`474c8c2` schema lock · `2e934a4` source layer · `2a46892` repo manifest → root `plugin.json`
(`.plugin/plugin.json` deleted) · `9ebfa8f` 13 examples + template · `6aa5754` living-docs sweep ·
`66344d2`/`ad50a20`/`2bc3c10` plan checkpoints.

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

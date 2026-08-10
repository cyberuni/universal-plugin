# 0005 — `plugin init`'s charter expands to repository/project init & setup

**Status:** accepted
**Date:** 2026-08-09
**Revises:** [ADR-0001](./0001-realign-to-build-engine.md)

## Context

ADR-0001 chartered `universal-plugin` to two concerns — the `plugin` command group (build / bundle /
validate / init) and `governance` — and declared marketplace, plugin-install, and lifecycle-hook ops
**out** to `cyberplace`. Within that charter, `plugin init` was defined narrowly: *scaffold a new
plugin project* (the canonical `.plugin/plugin.json`). It is **spec-only** — a frozen contract with
**no implementation yet** (ADR-0001 Consequences: the impl gate withholds certification for `plugin
validate` and `plugin init`).

Issue [#23](https://github.com/cyberuni/universal-plugin/issues/23) wants a **repository/project init
& setup** surface: set up a repo/project for agentic authoring across harnesses — the canonical
`.agents/skills/` layout with per-harness wiring (Facet 1) — and let an **npm package ship an agentic
plugin** (Facet 2), driven by an interactive gateway skill. This is broader than "scaffold a manifest."

Two placement questions follow: (a) does this land on a **new** top-level node or on the existing
`plugin init`? (b) where does authoring setup stop and someone else's job begin? While scoping #23 a
**third actor** surfaced that the earlier design capture missed: **repobuddy**, which owns
*consuming*-project setup. "Set up a repo" is ambiguous between *the repo you author a plugin in* and
*the repo that consumes installed plugins* — different owners.

## Decision

1. **Expand `plugin init`'s charter — do not add a new node.** `plugin init` grows from "scaffold the
   canonical manifest" to full **repository/project init & setup**: scaffold the manifest **and** set
   up the repo/project you author in (the `.agents/skills/` layout + per-harness wiring, and wiring an
   npm package to ship its built plugin), idempotently repairing existing wiring. Because `plugin init`
   is spec-only (unimplemented), the expanded capability is specced onto it directly — there is no
   implementation to break and no reason to stand up a parallel `init/` node. It stays inside the
   `plugin` command group; `universal-plugin` still has **two** concerns.

2. **Interactivity lives in a gateway skill, not the CLI.** An interactive gateway skill detects
   installed harnesses, offers a multi-select, explains the standard, and shells out to
   `universal-plugin plugin init …`. The CLI stays non-interactive (AXI contract).

3. **The authoring/consuming/distributing boundary is three-way:**
   - **`universal-plugin` (`plugin init`) = authoring.** Set up the repo/project you **author**
     plugins *in*. **This is what expands here.**
   - **`repobuddy` = consuming-project setup.** Set up a project that **consumes** installed plugins —
     a *different* concern, **out of scope for `universal-plugin`.** Any "prepare a project to use
     installed plugins" surface routes to repobuddy.
   - **`cyberplace` = distribution / runtime.** Publish *to* the marketplace, install *from* it,
     lifecycle hooks. Unchanged from ADR-0001.

4. **Scope is init/setup only — authoring-side.** `plugin init` scaffolds and idempotently repairs the
   wiring for a repo/package that *ships* an agentic plugin. It does **not** set up a consuming
   project's use of installed plugins (repobuddy), and does **not** publish or install (cyberplace).
   Two facets are in charter — (1) repo-level `.agents/` + harness compatibility, (2)
   npm-package-as-plugin. The `marketplace.json` catalog itself stays out.

## Consequences

- **Root `spec.md` is revised** (still two concerns): the `plugin init` capability-map row and the
  "why" narrative widen to repository/project init & setup, and the placement map routes a new
  init/setup op to **`plugin/init/`** (charter expanded) with explicit "consuming-project setup →
  `repobuddy`" and "publish/install → `cyberplace`" non-goals.
- **`plugin/init/`'s frozen spec is reopened and widened** by CR github-23 — legitimate, since it was
  never implemented. Its `.feature` is re-specced to cover both facets and re-frozen at the spec gate.
- **Low-regret, boundary-preserving.** Landing on the existing node avoids a near-duplicate `init/`
  concept; naming repobuddy as the consuming-setup owner keeps the authoring/consuming line explicit so
  `plugin init` cannot silently grow into consumer setup. ADR-0001's distribution boundary is intact.
- **No behavior ships in this ADR.** Like ADR-0001..0004 it is a design record (no `.feature`, no
  gate). The expanded `plugin/init/` spec and the gateway skill are specced and built by the rest of
  CR github-23.

## Deviation from the github-23 design capture

The settled design doc (`github-23-init-setup.design.md`) left node placement open (a top-level `init/`
capability *vs* a sub-node, "avoid collision with the frozen `plugin/init/`") and drew a **two-way**
split naming no consuming-setup owner. This ADR resolves both on new evidence: (a) placement lands **on
`plugin/init/`** — its spec-only status makes a parallel node unnecessary; (b) the split is **three-way**
with **repobuddy** owning consuming-project setup (surfaced while scoping #23; see the issue thread).
Every other design-doc decision — both-facets scope, symlink mechanics mirroring `vercel-labs/skills`,
the npm plugin source target, the gateway skill keeping interactivity out of the CLI — stands unchanged.

Note this narrows #23's framing: #23 calls the CR "charter-expanding — a third concern." The charter
*does* expand, but it expands the existing `plugin init` node rather than adding a third concern beside
the `plugin` group. The concern count stays two.

## Alternatives considered

- **A new top-level `init/` node (or a `setup/` group)** — rejected. `plugin init` is spec-only, so a
  parallel node would duplicate a near-identical concept and force collision-avoidance naming. Expanding
  the existing node is simpler and is what "init a plugin project" already implies.
- **Keep the two-way split; fold consuming-project setup in here too** — rejected. Consuming setup is
  repobuddy's charter; absorbing it would make `plugin init` both the author-side and consumer-side
  setup tool and blur the boundary this ADR draws.
- **Put init/setup in `cyberplace`** — rejected. It is local, deterministic, authoring-side scaffolding
  — an extension of `plugin init`, not a marketplace/install op.

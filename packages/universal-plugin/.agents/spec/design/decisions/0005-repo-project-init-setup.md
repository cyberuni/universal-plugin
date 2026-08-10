# 0005 — Repository/project init & setup is a third universal-plugin concern

**Status:** superseded in part
**Date:** 2026-08-04
**Revises:** [0001](./0001-realign-to-build-engine.md) (extends its concern list; leaves its
marketplace/install boundary intact)
**Superseded in part by:** [0006](./0006-narrow-init-setup-to-the-publish-half.md) — the **consume**
half below (canonical `.agents/skills/`, per-harness compatibility artifacts, the enabled-harness
record) is **withdrawn** and moves to `repobuddy/buddy-agent-harness`. The **publish** half
(`plugin init --npm`) and §3's AXI-#7 ruling stand. The inbound/outbound argument used here is
**invalid as a placement test** — see 0006 for why and for the shared-object rule that replaces it.

## Context

ADR-0001 chartered `universal-plugin` to **exactly two** concerns — the `plugin` command group and
`governance` — and pushed everything else out: marketplace / plugin-install / lifecycle-hook to
`cyberplace`, agent-facing authoring skills to `cyberspace` / `aced`, the cross-vendor sync engine to
a destination TBD.

Issue [#23](https://github.com/cyberuni/universal-plugin/issues/23) asks for a surface that fits none
of those slots: **setting up a repository or package for agentic authoring**. Two facets:

1. **Repo level** — create the canonical `.agents/skills/` layout and make it readable by every
   harness. Universal harnesses (Cursor, Codex, Copilot CLI, OpenCode, …) read `.agents/skills/`
   directly; non-universal ones (Claude Code, Windsurf, …) need a link into it. Which harnesses a
   repo has enabled is per-repo state that must be recorded somewhere.
2. **Package level** — let an npm package **ship** an agentic plugin: scaffold the canonical
   `.plugin/plugin.json` and wire `package.json` `files` so the *built* vendor manifest travels with
   the published tarball (Claude Code's npm plugin source reads `.claude-plugin/plugin.json` from
   inside the installed package).

Neither facet is marketplace work — nothing is published to or installed from a registry of plugins.
Both are local, deterministic scaffolding against artifacts this CLI already owns: the canonical
manifest (`plugin init` scaffolds it, `plugin build` derives from it) and `.agents/universal-plugin.json`
(the `config` group's file, per ADR-0001's successor placement note in the root spec).

So the charter question is narrow: is "set up the repo/project you author in" a *build-toolchain*
concern or a *distribution* concern?

## Decision

### 1. The boundary is the inbound/outbound line; init/setup is inbound

`universal-plugin` owns **three** concerns, not two:

1. **The `plugin` command group** — derive / validate / bundle / scaffold the canonical manifest.
2. **`governance`** — resolve governance documents by name across scopes.
3. **Repository/project init & setup** — prepare the repo or package you author in: the canonical
   `.agents/` layout, per-harness compatibility, and the wiring that lets a package ship its plugin.

The line that keeps `cyberplace` distinct is **inbound vs outbound**:

- **universal-plugin = author/build toolchain.** Everything that happens *before* a plugin leaves
  your machine — scaffold, derive, validate, materialize, and set up the workspace itself.
- **cyberplace = distribution/runtime.** Publishing *to* a marketplace, installing *from* one,
  lifecycle hooks.

**ADR-0001's marketplace/plugin-install boundary is unchanged.** This ADR does not move a single verb
out of `cyberplace`; it only names a concern ADR-0001 never considered and places it here. `init` is
a generalization of the `plugin init` precedent ADR-0001 already chartered — that verb scaffolds a
plugin *manifest*; this concern scaffolds the *repo and package* around it.

### 2. Scope of the concern — what is in, and what stays out

**In:** creating and maintaining the canonical `.agents/` layout; per-harness compatibility artifacts
derived from it; recording a repo's enabled harnesses in `.agents/universal-plugin.json`; wiring an
npm package so its built plugin manifest ships on publish.

**Out, unchanged:** marketplace publish/install and lifecycle hooks (`cyberplace`); the
`marketplace.json` catalog itself; the *content* of authoring skills — how to write a good skill or
plugin — which stays with `cyberspace` / `aced`.

### 3. Interactivity lives in a skill, never in the CLI

ADR-0003 binds every command to the AXI contract, which is non-interactive by construction. Harness
selection is genuinely interactive (detect what is installed, let a human multi-select). That
front-end therefore ships as a **skill** that shells out to the non-interactive CLI — it does not
become a TTY-prompting mode of the command.

This admits a narrow, deliberate exception to ADR-0001's "agent-facing authoring skills →
`cyberspace` / `aced`": that exclusion is about skills whose *subject* is authoring craft. A skill
whose entire body is the interactive front-end to **this CLI's own verb** is part of the verb, and
ships with it. It also resolves half of the root spec's deferred AXI principle #7 — the installable
skill is now in charter; **session hooks remain out** (`cyberplace`).

### 4. Universal-plugin dogfoods the concern

`packages/universal-plugin` becomes an agentic plugin itself — its own `.plugin/plugin.json` and the
gateway skill under `skills/` — deriving cleanly through `plugin build`. The package that ships the
setup concern is its own first consumer.

## Consequences

- **Root `spec.md` must be revised** before any node is placed: the "What this is" / "Why this is its
  own project" prose, the capability map, the placement map, and the by-concept index all describe a
  two-concern package today.
- **Node placement is opened, not decided here.** Whether the concern lands as a top-level capability
  or a sub-node, and how its verb avoids colliding with the frozen `plugin init` (repo/package setup
  vs manifest scaffold), are spec-gate questions for the CR — placement strategy stays
  **capability-first** per the root spec.
- **The package gains a second artifact kind.** `universal-plugin` has shipped only a CLI; it now
  also ships a `skills/` tree that `plugin build` derives from. The build path that previously ran
  only against *other* projects now runs against this one.
- **`.agents/universal-plugin.json` takes on a second reader class.** It already holds `packagePath`
  and plugin-registered keyed arrays; it now also carries a repo's enabled-harness record. The
  `config` group's preserve-every-other-key guarantee is what makes that safe.
- **The "destined to leave" sync engine is untouched.** Nothing here changes its status.

## Alternatives considered

- **Put init/setup in `cyberplace`.** Rejected. Nothing about it is distribution: no registry, no
  marketplace entry, no install of someone else's plugin. It would also invert the dependency —
  `cyberplace` would have to reach into this package's manifest scaffolder, vendor/harness knowledge,
  and config file to do its job.
- **A third package (`agents-init` or similar).** Rejected. It would share the canonical manifest,
  the harness/vendor registry, and `.agents/universal-plugin.json` with this CLI, splitting one
  deterministic scaffolder across two release units for no boundary gain.
- **Keep ADR-0001's two concerns and file init/setup as an unchartered extra.** Rejected — that is
  exactly the drift ADR-0001 was written to end. A concern this package genuinely owns should be
  named in the charter, not tolerated beside it.
- **Make the CLI interactive when attached to a TTY.** Rejected — it contradicts ADR-0003/AXI and
  would make the command's behavior depend on how it was invoked. The skill front-end costs nothing
  and keeps the command deterministic.

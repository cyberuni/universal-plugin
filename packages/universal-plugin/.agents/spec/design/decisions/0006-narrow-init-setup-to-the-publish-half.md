# 0006 — Narrow the init/setup concern to the publish half; harness consumption leaves

**Status:** accepted
**Date:** 2026-08-05
**Supersedes in part:** [0005](./0005-repo-project-init-setup.md) — its **consume** half is withdrawn;
its **publish** half (`plugin init --npm`) stands. ADR-0001's marketplace/install boundary remains
untouched by both.

## Context

ADR-0005 admitted "repository/project init & setup" as a third `universal-plugin` concern, covering
two halves:

- **consume** — establish the canonical `.agents/skills/` layout, create each harness's compatibility
  artifact, record the enabled harnesses.
- **publish** — wire an npm package's `package.json` `files` so its built plugin manifest ships.

The argument for placing both here was the **inbound/outbound** line: universal-plugin is the
author/build toolchain, `cyberplace` is distribution/runtime, init/setup is inbound, therefore it
belongs here.

**That argument is invalid, and the defect is worth recording precisely.** Inbound/outbound
distinguishes this package from `cyberplace` and nothing else. It is a **necessary** condition, not a
**sufficient** one: it rules `cyberplace` out; it never ruled `universal-plugin` in. Every local,
deterministic operation passes it. ADR-0005 used a filter as if it were a proof.

Applying a positive test instead exposes the problem. This CLI's object is the **canonical manifest** —
`plugin build`, `bundle`, `validate`, and `init` all operate on it; `config` operates on the CLI's own
config file. The consume half touches neither, as the withdrawn node stated in its own words:

> `setup` never reads or writes a plugin manifest.

The audiences differ too. `plugin *` serves a plugin **author**; harness consumption serves anyone
using skills, including repositories that will never author a plugin. Neither depends on the other.

There was also a pattern this should have surfaced earlier: `governance` and `run` are **both** already
carried in the placement map with explicit "recorded placement, not charter drift" notes. `setup` would
have been the third. A charter that needs an exception note each time it grows is the thing that is
wrong.

## Decision

### 1. The consume half is not this package's concern

Establishing `.agents/skills/`, deriving per-harness compatibility artifacts, and recording a
repository's enabled harnesses are **withdrawn** from `universal-plugin`. The root spec returns to
describing the `plugin` group and `governance` (plus the previously recorded `config` and `run`
placements). There is no third concern.

### 2. The publish half stays, unchanged

`plugin init --npm` remains in charter and keeps its additive scenarios. Its object **is** the
canonical manifest and the wiring that ships it — the shared-object test it passes cleanly. The
pattern already has a live consumer: `repobuddy/buddy-codecov` ships a canonical `.plugin/plugin.json`
on this project's schema, derived `.claude-plugin/`, `.cursor-plugin/` and `.codex-plugin/` manifests,
and a `files` array carrying them.

### 3. Placement is decided by shared object, not by direction

The rule that replaces "is it inbound?":

> A concern belongs to `universal-plugin` only if its object is the **canonical manifest** or this
> CLI's **own configuration**. Direction (inbound vs outbound) only separates this package from
> `cyberplace`; it never establishes a home on its own.

### 4. The consume half's destination

It goes to **`repobuddy/buddy-agent-harness`** — a standalone repository modelled on
`repobuddy/buddy-codecov`, shipping a `buddy-agent-harness` CLI, a `harness` command group mounted on
the `repobuddy` CLI (`bd harness init`), its own agentic plugin, and an interactive harness-selection
skill. Its per-repository enabled-harness record lives at `.agents/buddy-agent-harness/config.json`,
not in `.agents/universal-plugin.json`.

The fit is the same test applied positively: `repobuddy`'s object is **the repository**, and harness
consumption is repository management.

### 5. AXI principle #7's skill half survives on its own reasoning

ADR-0005 §3 admitted the installable-skill half of AXI #7 — a skill whose body is the interactive
front-end to one of this CLI's own verbs ships with that verb, while the `cyberspace` / `aced`
exclusion covers only skills whose *subject* is authoring craft. That boundary is independent of which
verb motivated it, so it **stands**. Session-hook wiring remains out (`cyberplace`).

Note honestly that **no `universal-plugin` verb requires such a skill today** — the one that did has
left. The clause is a correct boundary with no current instance.

## Consequences

- **Root `spec.md` reverts** to a two-concern description: the "What this is" and "Why this is its own
  project" prose, the capability map row, and the placement-map consume rule all come out. The
  `plugin init --npm` publish rule stays.
- **The `setup/` node is deleted** — its README and its 35-scenario suite. It was never implemented,
  so nothing shipped is affected.
- **The verified harness registry must migrate, not vanish.** Five rows checked against primary vendor
  documentation (Claude Code, Cursor, Codex, Copilot CLI, Windsurf) — one of which, Windsurf, was wrong
  until verified — plus the conflict pre-flight rule, relative-symlink-with-copy-fallback, the
  `claude-code` always-link exception, and the never-create-an-absent-harness-dir rule. All of it is
  recoverable from this branch's history (the `setup/` node as of `bdc0f51`) and is the starting
  material for `buddy-agent-harness`.
- **The CR's scope shrinks** to `plugin init --npm` plus this ADR. The gateway-skill node and the
  delivery facets for harness consumption are no longer this CR's work.
- **ADR-0005 is not deleted.** Its publish-half reasoning is still in force, and the record of the
  invalid placement argument is worth keeping — that is what this ADR exists to correct.

## Alternatives considered

- **Keep both halves here (ADR-0005 as written).** Rejected — no shared object with the manifest, a
  different audience, and a third consecutive charter-exception note.
- **A new package inside this monorepo.** Rejected — the concern's object is the repository, and
  `repobuddy` is already the repository-management CLI with a plugin architecture, a published
  `bd`/`buddy` binary, and an existing repo-setup skill (`setup-github-repo`).
- **`cyber-skills`.** Considered seriously: its object is *skills*, which fits, and its
  `agent-initialization` plugin already performs the `AGENTS.md` → `CLAUDE.md` symlink half. Not
  chosen — it is a skills/marketplace repo, whereas the harness wiring is repository management, and
  `repobuddy`'s plugin model gives the command a natural mount point.
- **Rewrite ADR-0005 in place.** Rejected — this project's precedent is a new ADR plus a pointer
  (0005 amended 0001 that way), and the faulty reasoning is instructive enough to keep on the record.

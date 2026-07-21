---
status: implemented
name: universal-plugin
project-path: packages/universal-plugin
approval:
  spec:
    verdict: approve
    by: agent
    cause: dimension
    why:
      floor: none — additive. `run/` gains 1 purely-additive scenario (`gherkin-cli diff`: 1 added / 0 modified / 0 removed) locking the dist-tag miss notice, so its freeze self-clears with no re-open. Clearance n/a (nothing narrowed), Compatibility n/a (patch-level notice-wording refinement — no shipped semver bump this CR), Conflict none (new scenario compatible with the sibling `@next` and the range-miss scenarios).
      blast: minor — one additive scenario on `run/` plus a `distTagNotice`/`fallbackNotice` split in `src/run/run.ts`; no other node or command touched.
      novelty: low — a notice-wording correctness fix realizing github-10 follow-up #12 (item 2): a dist-tag miss must not claim installed versions failed to "satisfy" the tag, since a tag is not a range.
      confidence: high — cold sdd-spec-judge 3-lens {oracle, builder, architect} ALIGNED true; new scenario discriminates (a naive shared-notice fix fails it); prose↔suite 1:1; additive `gherkin-cli diff` verified. Self-asserted (by agent, auto-spec leash).
      cr: github-12
  impl:
    verdict: approve
    by: agent
    cause: dimension
    why:
      floor: none — purely additive impl against the just-frozen scenario. No Clearance (nothing narrowed/deleted), no Compatibility (notice-wording refinement — no shipped semver bump this CR), no Conflict (frozen suite stayed self-consistent).
      blast: minor — `src/run/run.ts` gains `distTagNotice` (the npx-fallback path picks it vs `fallbackNotice` by `isSemverRange(range)`); verifications added in `src/run/run.test.ts` + `src/bin/upx.test.mts`. No sync/network/bundle surface touched.
      novelty: low — split the shared fallback notice so the dist-tag branch names the tag instead of claiming "satisfies"; range-miss and bare-`*` paths keep `fallbackNotice` unchanged.
      confidence: high — cold sdd-impl-judge re-derived all 26 frozen scenarios by hand and verified each; range-miss notice still contains "satisfies" (split non-regression confirmed); pnpm test green (253/253 across 16 files, +2 vs github-10); run.ts stays pure domain; no scope creep. Passed clean first round (no judge-iteration correction). Self-asserted (by agent) — ratify or kick back.
      cr: github-12
---

# universal-plugin — the cross-vendor plugin build/derivation engine (CLI)

> Root project spec — the **descriptive** top index for the `universal-plugin` **CLI** (the npm
> package at `packages/universal-plugin`). Behaviors live in the capability folders below. This spec
> was backfilled from the legacy `packages/universal-plugin/specs/` tree and **realigned**: the
> package is the deterministic build/derivation engine, not the marketplace, the authoring-skill
> layer, or the cross-vendor sync engine. `spec.md` is itself the human-readable index — there is no
> sibling `README.md`.

## What this is

One canonical `.plugin/plugin.json` is the single source of truth for a plugin. The `universal-plugin`
CLI turns that canonical manifest into what each AI-agent runtime (Claude Code, Cursor, Codex,
Copilot CLI) expects, and resolves shared governance documents by name. Two concerns:

- **The `plugin` command group** — `universal-plugin plugin build` **derives** per-vendor manifests
  from the canonical one; `plugin bundle` **materializes** the release form (pins the plugin's skill
  `npx <cli>@<version>` references to the shipping workspace versions); `plugin validate` **checks** the
  canonical manifest against the schema and each vendor's rules; `plugin init` **scaffolds** a new
  plugin project.
- **`governance`** — `universal-plugin governance show <name>` / `list` **resolves** governance
  documents by name across a fixed scope precedence, so agents reference governance by name, not by a
  fragile filesystem path.

Everything here is deterministic CLI behavior (SDD-default + a script harness — boolean scenarios,
no rubric).

Every command follows the **AXI** ([Agent Experience Interface](https://github.com/kunchenguid/axi))
output contract — token-efficient [TOON](https://toonformat.dev/) output by default, minimal schemas,
pre-computed aggregates, definitive empty states, structured/fail-loud errors, content-first group
commands, next-step suggestions, and consistent help — stated once in [`axi/`](./axi/README.md) and
exercised by each behavioral node (ADR-0003). AXI principle #7 (session-hook setup + installable
skill) is deferred to a follow-up CR: it crosses the charter boundary (hooks → `cyberplace`, skills →
`cyberspace`/`aced`).

## Why this is its own project

The old `universal-plugin` spec advertised a monolith (build, validate, init, prepare, governance,
plugin-install, hook, marketplace). The repo's concern split broke that apart:

- **marketplace / plugin-install / lifecycle-hook** ops belong to the **`cyberplace`** package (the
  agent skill/plugin marketplace + authoring CLI).
- **agent-facing authoring skills** (create/publish/write-vendor-config) belong to the **`cyberspace`**
  and **`aced`** plugins.
- the **cross-vendor sync engine** currently shipping under this package (`prepare <vendor-id>`
  detect → `sync apply` → `self-update` / `publish sync-version`, backed by the asset-store and the
  source/vendor registries and state) is a **separate concern destined to leave** — see the Placement
  map non-goals and `design/decisions/`.

What remains here — deriving, validating, and scaffolding the canonical manifest, plus resolving
governance by name — is the deterministic engine. It ships to npm as one `universal-plugin` bin and
is a peer of the `cyberfleet` CLI.

## Capability map

| Folder | Type | What |
|---|---|---|
| [`plugin/`](./plugin/README.md) | group | the `plugin` command group — build / bundle / validate / init |
| [`plugin/build/`](./plugin/build/README.md) | behavioral | `universal-plugin plugin build [--vendor] [--dry-run] [--clean]` — derive per-vendor manifests from the canonical `.plugin/plugin.json` (dev-consumable form; no pins) |
| [`plugin/bundle/`](./plugin/bundle/README.md) | behavioral | `universal-plugin plugin bundle [--dry-run] [--full] [--format] [--runner]` — materialize the release form: pin the `npx`/`upx <cli>@<version>` references in the plugin's skills to their shipping workspace versions (`--runner` selects the emitted runner word) |
| [`plugin/validate/`](./plugin/validate/README.md) | behavioral | `universal-plugin plugin validate [--vendor] [--strict]` — check the canonical manifest against schema + vendor rules |
| [`plugin/init/`](./plugin/init/README.md) | behavioral | `universal-plugin plugin init [--name] [--vendor] [--scaffold] [--force] [--yes]` — scaffold a new plugin project |
| [`governance/`](./governance/README.md) | behavioral | `universal-plugin governance show <name>` / `list` — resolve governance documents by name across scopes |
| [`run/`](./run/README.md) | behavioral | `upx <pkg>@<range> [args…]` — a lean **second bin**: run a package's CLI from a range-satisfying local/global install (fast), else fall back to `npx`. Kept separate from the main CLI for fast cold-start |
| [`axi/`](./axi/README.md) | reference | the **AXI** output contract — shared token-efficient CLI conventions (TOON default, aggregates, empty states, next-step, fail-loud, content-first, help) every command follows |

## Placement map

Where a new concept lives — slot here, do not invent placement (strategy = **capability-first**):

- **a new canonical-manifest op** (derive / check / scaffold the `.plugin/plugin.json`) →
  `plugin/<verb>/` (a new unit node under the `plugin` group).
- **a new op resolving/pinning the version pins in the plugin's own skills** (the
  `npx <cli>@<version>` references a plugin's skills carry) → **`plugin/bundle/`** — pinning is a
  release-time **materialization** step (resolve each workspace CLI to the version in its local
  `packages/<pkg>/package.json` at `changeset version`, skipping doc-example and external pins),
  distinct from `build`'s dev-time manifest derivation. `build` no longer touches pins. It is **not**
  the `self-update` hook-file concern (updating `universal-plugin`'s own pin across a project's hook
  files departs with the sync engine — see the non-goals below).
- **a new name→document resolution op** (resolve or list governance by name across scopes) →
  `governance/`.
- **a new fast-invocation / package-runner op** (run an installed CLI in place of `npx`) → `run/`
  (the `upx` bin). **Charter note:** a generic runner is broader than "derive/validate/scaffold the
  manifest", but it lives here deliberately — `plugin bundle` already emits `upx` references at release,
  so the runner and its emitter ship and version as one unit — and ships as a **separate lean bin** so
  its cold-start stays fast. Recorded placement, not charter drift.
- **a new shared output / CLI convention** (TOON shape, aggregate, next-step, empty-state,
  truncation, help, content-first) → `axi/` (the reference contract), plus concrete scenarios in each
  behavioral node that exercises it. Never a per-command copy of the convention.
- **a cross-capability CLI e2e** (spans ≥2 nodes) → `acceptance/`.
- **marketplace / plugin-install / lifecycle-hook op** → **not here** — that is the `cyberplace`
  package.
- **cross-vendor sync / self-update / publish / asset-store op** → **not a capability here** — the
  shipped sync engine is a non-goal **destined to leave** `universal-plugin` (destination TBD; see
  `design/decisions/`).
- **post-install artifact-copy (`prepare`)** → **dropped** — not chartered in this spec.

The nesting rule: capabilities at the top; a command group (`plugin/`) may hold unit nodes
(`plugin/build/`, `plugin/bundle/`), but no node is three deep — any further sub-grouping is a
`concept:` tag, not a folder. The `plugin/` group index carries no `spec-type` marker (it is a descriptive index, not a
scanned node).

<!-- BEGIN generated: by-concept (project-spec/concept-index) -->

## By concept

> Generated from `concept:` frontmatter by `project-spec/concept-index` — do not edit by hand.

| Concept | Facets |
|---|---|
| `axi` | `axi/` (reference) · `governance/` (behavior) · `plugin/build/` (behavior) · `plugin/bundle/` (behavior) · `plugin/init/` (behavior) · `plugin/validate/` (behavior) · `run/` (behavior) |
| `canonical-manifest` | `plugin/build/` (behavior) · `plugin/init/` (behavior) · `plugin/validate/` (behavior) |
| `governance` | `governance/` (behavior) |
| `release` | `plugin/bundle/` (behavior) |
| `run` | `run/` (behavior) |

<!-- END generated: by-concept -->

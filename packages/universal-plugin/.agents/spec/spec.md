---
status: implemented
name: universal-plugin
project-path: packages/universal-plugin
approval:
  spec:
    verdict: approve
    by: unional
    cause: dimension
    why:
      floor: none — all-new `config/` nodes; no pre-existing frozen scenario touched. Clearance n/a, Compatibility n/a (impl unbuilt this CR — no shipped semver bump), Conflict none (both suites self-consistent).
      blast: moderate — new `config/` command group + `config/add` + `config/get` behavioral nodes; dropped the dead `vendors` key from `.agents/universal-plugin.json`; root capability/placement/by-concept + `axi/` exercised-by maps updated.
      novelty: moderate — a plugin-registered keyed config store in the CLI's own `.agents/universal-plugin.json` (append-or-replace-by-`name` idempotent `add` + lazy `get`) realizing #8; reserved-key `packagePath` rejection (the CLI's own string config, read by `publish sync-version`); AXI-conformant (TOON default keyed on `name` + count aggregate; `--format json` raw stored array).
      confidence: high — cold sdd-spec-judge 3-lens {oracle, builder, architect} ALIGNED true on round 3 (0 findings); 33 boolean scenarios, prose↔suite 1:1 both ways; both `.feature` parse clean (gherkin-cli) + `check-suite` OK. R1 caught exit-code discrimination + table-row gaps + unfalsifiable replace-position + missing reserved-key coverage; R2 caught 4 stale-`vendors` prose refs — both fixed, grep-verified zero `vendors` in `config/`+`axi/`. Ratified by the user in-session ("ratify").
      cr: github-8
  impl:
    verdict: approve
    by: unional
    cause: dimension
    why:
      floor: none — purely additive impl against the frozen contract. No Clearance (nothing narrowed/deleted), no Compatibility (new `config` command group — no shipped semver bump this CR), no Conflict (both frozen suites stayed self-consistent; the rebase-onto-`main` conflict was in the `spec.md` approval block, resolved to github-8 — not a `.feature` edit).
      blast: moderate — new `src/config/` (pure domain + `ConfigFs` adapter + AXI-wired `cli.ts`) building the `config add`/`config get` group, wired into `src/cli.ts`; empty state prints `(none)`. Also dropped the dead `vendors` key and removed the outdated `.agents/governances/cli-command.md` governance. No sync/network surface touched.
      novelty: moderate — a plugin-registered keyed config store in the CLI's own `.agents/universal-plugin.json` (append-or-replace-by-`name` idempotent `add` + lazy `get`); reserved-key `packagePath` rejection; AXI-conformant output.
      confidence: high — cold sdd-impl-judge re-derived all 33 frozen scenarios independently and verified each, mutation-backstopped on reserved-key + replace-by-name (both mutations caught, file restored); merged tree green (`pnpm verify` 295/295 across 18 files, rebased onto `main` `c26b019`); clean-architecture layering confirmed; no `.feature`/`.agents/spec` edits by the impl-producer. Ratified by the user in-session ("ratify").
      cr: github-8
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
| [`config/`](./config/README.md) | group | the `config` command group — read/write plugin-registered keyed config in `.agents/universal-plugin.json` |
| [`config/add/`](./config/add/README.md) | behavioral | `universal-plugin config add --key <key> --entry '<json>'` — append (or replace by `name`) an entry in the array at `<key>`; idempotent, preserves other keys |
| [`config/get/`](./config/get/README.md) | behavioral | `universal-plugin config get --key <key> [--format json]` — read the array at `<key>` (TOON default; raw array under `--format json`) |
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
- **a new plugin-registered config op** (read or write a keyed array in `.agents/universal-plugin.json`
  that plugins write at install and other plugins read at runtime) → `config/` (a verb node under the
  `config` group: `config/add/` writes, `config/get/` reads). **Charter note:** a keyed config store is
  broader than "derive/validate/scaffold the manifest", but it lives here deliberately — the file it
  reads and writes is **this CLI's own** `.agents/universal-plugin.json` (already the home of
  `packagePath`, read by `publish sync-version`), resolved from cwd; owning structured access to its own
  config file is not the marketplace/install concern that departs to `cyberplace`. Recorded placement,
  not charter drift. A config op **preserves every other top-level key** on write. **Reserved key:**
  `packagePath` is the CLI's own **string** config, not a plugin-registered array — both verbs **reject**
  `--key packagePath` (fail loud, write nothing) rather than coerce it. Entry-shape validation beyond
  valid JSON + a required `name` (the `add` merge key) is the **consumer's**, not this CLI's.
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
| `axi` | `axi/` (reference) · `config/add/` (behavior) · `config/get/` (behavior) · `governance/` (behavior) · `plugin/build/` (behavior) · `plugin/bundle/` (behavior) · `plugin/init/` (behavior) · `plugin/validate/` (behavior) · `run/` (behavior) |
| `canonical-manifest` | `plugin/build/` (behavior) · `plugin/init/` (behavior) · `plugin/validate/` (behavior) |
| `config` | `config/add/` (behavior) · `config/get/` (behavior) |
| `governance` | `governance/` (behavior) |
| `release` | `plugin/bundle/` (behavior) |
| `run` | `run/` (behavior) |

<!-- END generated: by-concept -->

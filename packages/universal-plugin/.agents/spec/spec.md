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
      floor: none — user-directed re-open rewrote the prematurely frozen marketplace suite without dropping its prior behavior; the new contract widens safety and observability coverage. Compatibility is deferred to the implementation gate; Conflict none.
      blast: moderate — one behavioral node plus its root capability and generated concept indexes; local repository metadata only.
      novelty: moderate — bounded top-level marketplace manifests that deliberately coexist with canonical agent-plugin manifests; per-artifact atomic writes, explicit write-error reporting, and containment guards.
      confidence: high — two cold spec judges aligned Oracle, Builder, and Architect after re-derivation and the user-directed write-semantics re-open; 37 mapped boolean scenarios; Gherkin parse, referenced-artifact/use-case coverage, root state, and concept-index checks pass. The isolated check-suite dependency is unavailable, so gherkin-cli parse is the executable form evidence.
      cr: github-25
  impl:
    verdict: approve
    by: agent
    cause: dimension
    why:
      floor: none — the user explicitly authorized the selected-write contract to weaken from cross-artifact rollback to honest best-effort error reporting; no frozen behavior was silently dropped. Compatibility none; Conflict none.
      blast: moderate — marketplace discovery and filesystem adapter gain bounded direct-child traversal and local containment checks; no network or provisioning surface.
      novelty: moderate — physical-path containment for all local manifest and generated-output boundaries, plus per-artifact atomic write failure semantics.
      confidence: high — cold implementation judge passed every frozen contract dimension; full package verification passes (305 tests), Gherkin parses 37 frozen scenarios, spec-state and concept-index checks pass.
      cr: github-25
---

# universal-plugin — the cross-vendor plugin build/derivation engine (CLI)

> Root project spec — the **descriptive** top index for the `universal-plugin` **CLI** (the npm
> package at `packages/universal-plugin`). Behaviors live in the capability folders below. This spec
> was backfilled from the legacy `packages/universal-plugin/specs/` tree and **realigned**: the
> package is the deterministic build/derivation engine, not the marketplace, the authoring-skill
> layer, or the cross-vendor sync engine. `spec.md` is itself the human-readable index — there is no
> sibling `README.md`.

## What this is

One canonical `plugin.json` at the project root — Agent Plugins Specification v1.0.0 form, a **closed**
field set with tool-specific data under `extensions` (ADR-0007) — is the single source of truth for a
plugin. The `universal-plugin` CLI turns that canonical manifest into what each AI-agent runtime
(Claude Code, Cursor, Codex, Copilot CLI) expects, and resolves shared governance documents by name.
Two concerns:

- **The `plugin` command group** — `universal-plugin plugin build` **derives** per-vendor manifests
  from the canonical one; `plugin bundle` **materializes** the release form (pins the plugin's skill
  `npx <cli>@<version>` references to the shipping workspace versions); `plugin validate` **checks** the
  canonical manifest against the schema and each vendor's rules; `plugin init` **scaffolds** the
  canonical manifest, and `plugin init --npm` additionally wires an npm package so its **built** vendor
  manifests ship on `npm publish` — the one **publish-side** setup op in charter (ADR-0006). Setting a
  directory up to *consume* skills (the `skills/` layout, per-harness compatibility artifacts, the
  enabled-harness record) is **not** here — that is `repobuddy/buddy-agent-harness`.
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
skill) is **half in charter**: the installable skill — one that is the interactive front-end to this
CLI's own verb — ships with the verb (ADR-0005 §3), while **session hooks stay out** (`cyberplace`)
and skills whose *subject* is authoring craft stay with `cyberspace`/`aced`. No verb here needs such a
skill today — the one that did (harness selection) left with the consume half (ADR-0006 §5).

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
- **consuming-project setup** — setting a directory up to *use* installed plugins (the skills layout,
  per-harness compatibility, the enabled-harness record) — belongs to
  **`repobuddy/buddy-agent-harness`**, not here (ADR-0006).

What remains here — deriving, validating, and scaffolding the canonical manifest (including wiring a
package to ship it via `plugin init --npm`), plus resolving governance by name — is the deterministic
engine. It ships to npm as one `universal-plugin` bin and is a peer of the `cyberfleet` CLI.

**What decides whether something belongs here is the object it operates on** (ADR-0006): a concern is
this package's only if its object is the **canonical manifest** or this CLI's **own configuration**.
That is why `plugin init --npm` is in charter — it wires how the manifest ships — while setting a
directory up to *consume* skills is not, since it touches neither. Direction (**inbound vs outbound**)
still separates this package from `cyberplace`, but it is a **necessary condition, not a sufficient
one**: it rules `cyberplace` out; it never rules this package in. ADR-0005 used it as if it did, and
ADR-0006 corrects that.

## Capability map

| Folder | Type | What |
|---|---|---|
| [`plugin/`](./plugin/README.md) | group | the `plugin` command group — build / bundle / validate / init / version |
| [`plugin/build/`](./plugin/build/README.md) | behavioral | `universal-plugin plugin build [--vendor] [--dry-run] [--clean]` — derive per-vendor manifests from the canonical `plugin.json` (dev-consumable form; no pins) |
| [`plugin/bundle/`](./plugin/bundle/README.md) | behavioral | `universal-plugin plugin bundle [--dry-run] [--full] [--format] [--runner]` — materialize the release form: pin the `npx`/`upx <cli>@<version>` references in the plugin's skills to their shipping workspace versions (`--runner` selects the emitted runner word) |
| [`plugin/validate/`](./plugin/validate/README.md) | behavioral | `universal-plugin plugin validate [--vendor] [--strict]` — check the canonical manifest against schema + vendor rules |
| [`plugin/version/`](./plugin/version/README.md) | behavioral | `universal-plugin plugin version <major\|minor\|patch\|pre*\|x.y.z> [--preid] [--force] [--no-build] [--dry-run]` — move the plugin's version: write the two **authored** numbers (canonical `plugin.json`, and the `packagePath` `package.json` when declared), then re-derive the vendor manifests through `build`'s own writer |
| [`plugin/init/`](./plugin/init/README.md) | behavioral | `universal-plugin plugin init [--name] [--vendor] [--scaffold] [--force] [--yes] [--npm]` — scaffold the canonical `plugin.json`; `--npm` also wires an npm package's `files` to ship the derived vendor manifests (ADR-0006). Consuming-side harness setup → `repobuddy/buddy-agent-harness` |
| [`governance/`](./governance/README.md) | behavioral | `universal-plugin governance show <name>` / `list` — resolve governance documents by name across scopes |
| [`marketplace/`](./marketplace/README.md) | group | the repository-local marketplace metadata command group |
| [`marketplace/init/`](./marketplace/init/README.md) | behavioral | `universal-plugin marketplace init [--claude] [--codex] [--copilot] [--cursor]` — generate local vendor catalogs or a Cursor submission scaffold; no remote marketplace operation |
| [`config/`](./config/README.md) | group | the `config` command group — read/write plugin-registered keyed config in `.agents/universal-plugin.json` |
| [`config/add/`](./config/add/README.md) | behavioral | `universal-plugin config add --key <key> --entry '<json>'` — append (or replace by `name`) an entry in the array at `<key>`; idempotent, preserves other keys |
| [`config/get/`](./config/get/README.md) | behavioral | `universal-plugin config get --key <key> [--format json]` — read the array at `<key>` (TOON default; raw array under `--format json`) |
| [`run/`](./run/README.md) | behavioral | `upx <pkg>@<range> [args…]` — a lean **second bin**: run a package's CLI from a range-satisfying local/global install (fast), else fall back to `npx`. Kept separate from the main CLI for fast cold-start |
| [`axi/`](./axi/README.md) | reference | the **AXI** output contract — shared token-efficient CLI conventions (TOON default, aggregates, empty states, next-step, fail-loud, content-first, help) every command follows |

## Placement map

Where a new concept lives — slot here, do not invent placement (strategy = **capability-first**):

- **a new canonical-manifest op** (derive / check / scaffold the root `plugin.json`) →
  `plugin/<verb>/` (a new unit node under the `plugin` group).
- **a new op that _moves_ the plugin's version** (bump or set the number the plugin releases under) →
  **`plugin/version/`**. The rule that keeps it one verb: a version lives in exactly two **authored**
  files — the canonical `plugin.json` and, when `packagePath` is declared, that `package.json` — and
  every other occurrence is **derived** by a command that already exists (`plugin build` for the
  vendor manifests, `marketplace init` for the local catalogs, `plugin bundle` for the skill pins).
  A version op therefore writes the authored pair and **calls** the existing deriver; it never writes
  a derived file itself, which would fork a second writer beside the one that owns it. The opposite
  direction — a changesets-decided number flowing `package.json` → manifest — stays `publish
  sync-version`, sharing this node's applier so the two cannot drift.
- **a new op resolving/pinning the version pins in the plugin's own skills** (the
  `npx <cli>@<version>` references a plugin's skills carry) → **`plugin/bundle/`** — pinning is a
  release-time **materialization** step (resolve each workspace CLI to the version in its local
  `packages/<pkg>/package.json` at `changeset version`, skipping doc-example and external pins),
  distinct from `build`'s dev-time manifest derivation. `build` no longer touches pins. It is **not**
  the `self-update` hook-file concern (updating `universal-plugin`'s own pin across a project's hook
  files departs with the sync engine — see the non-goals below).
- **a new name→document resolution op** (resolve or list governance by name across scopes) →
  `governance/`.
- **a new repository-local marketplace metadata derivation** (discover eligible plugin roots and
  emit vendor catalogs or an explicit Cursor submission scaffold) → `marketplace/init/`. This is
  deterministic file generation only: publishing, registration, installation, authentication,
  provisioning, dashboard automation, and service APIs remain outside this package.
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
- **a new op making an npm package _publish_ a plugin** (wire `package.json` `files` so the built
  vendor manifests ship — e.g. the derived `.claude-plugin/plugin.json` for Claude Code's npm plugin
  source) → **`plugin/init/`**, under its `--npm` flag. `plugin init` already scaffolds the canonical
  `plugin.json`; publishing is that same scaffold plus its shipping wiring, so it stays one verb on the
  manifest rather than a second beside it. In charter because its object **is** the manifest (ADR-0006).
- **a new shared output / CLI convention** (TOON shape, aggregate, next-step, empty-state,
  truncation, help, content-first) → `axi/` (the reference contract), plus concrete scenarios in each
  behavioral node that exercises it. Never a per-command copy of the convention.
- **a cross-capability CLI e2e** (spans ≥2 nodes) → `acceptance/`.
- **an op setting up a directory to _consume_ skills** (the `skills/` layout, per-harness compatibility
  artifacts, the enabled-harness record) → **not here** — that is `repobuddy/buddy-agent-harness`. It
  touches neither the canonical manifest nor this CLI's own config, so it fails the shared-object test;
  ADR-0006 withdrew it from ADR-0005.
- **remote marketplace / plugin-install / lifecycle-hook op** → **not here** — that is the
  `cyberplace` package. Repository-local marketplace metadata derivation is the narrow exception
  placed at `marketplace/init/` above.
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
| `axi` | `axi/` (reference) · `config/add/` (behavior) · `config/get/` (behavior) · `governance/` (behavior) · `marketplace/init/` (behavior) · `plugin/build/` (behavior) · `plugin/bundle/` (behavior) · `plugin/init/` (behavior) · `plugin/validate/` (behavior) · `plugin/version/` (behavior) · `run/` (behavior) |
| `canonical-manifest` | `plugin/build/` (behavior) · `plugin/init/` (behavior) · `plugin/validate/` (behavior) · `plugin/version/` (behavior) |
| `config` | `config/add/` (behavior) · `config/get/` (behavior) |
| `governance` | `governance/` (behavior) |
| `marketplace` | `marketplace/init/` (behavior) |
| `release` | `plugin/bundle/` (behavior) · `plugin/version/` (behavior) |
| `run` | `run/` (behavior) |

<!-- END generated: by-concept -->

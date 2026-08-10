# 0007 — Adopt Agent Plugins Specification v1.0.0 as the canonical; derive per-harness manifests

**Status:** accepted
**Date:** 2026-08-09
**Revises:** [0001](./0001-realign-to-build-engine.md) — its canonical-manifest premise
(`.plugin/plugin.json`) is replaced. **Builds on:** [0006](./0006-narrow-init-setup-to-the-publish-half.md)
— retargets the surviving publish half (`plugin init --npm`) onto the layout decided here.

## Context

`universal-plugin` picked `.plugin/plugin.json` as its canonical manifest and `.agents/skills/` as the
skills layout, and `schema/v1.json` advertised itself as *"open-plugin-spec v1.0.0 **extended** with
`vendors` and `vendorExtensions`"* — sibling top-level keys.

The upstream spec (now **Agent Plugins Specification v1.0.0**, `agent-plugins.org`, still the
vercel-labs/open-plugin-spec repo) has been rewritten and now pins three things hard:

- **Manifest at the plugin root: `plugin.json`** — a single fixed path, no `.plugin/` subdir (§5.1).
- **Fixed component locations:** skills at **`skills/`**, MCP config at **`mcp.json`** (§6.1).
- **A closed manifest field set** — exactly `$schema` (required const
  `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`), `name` (required), `version`,
  `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `extensions`.
  **`additionalProperties: false` — no sibling keys.** Tool-specific data goes **only** under
  `extensions`, keyed by a reverse-domain namespace, optionally with a top-level `com.vendor.x/`
  directory (§8).

Two facts about the runtimes bound the decision:

- **The real runtimes mostly do not read root `plugin.json`.** They keep their own per-harness manifest
  paths (Claude Code reads `.claude-plugin/plugin.json`, etc.). The spec is a **format standard**, not
  yet a runtime contract.
- **Per-harness manifests carry different content** from the canonical and from each other. Identical
  files could be linked; **different files cannot** — so the wiring is **derivation**, never a symlink.

This is exactly the seam `universal-plugin` exists to fill: one canonical input, N derived vendor
outputs. Adopting the spec as the **canonical input format** aligns the tool with the emerging
standard while its derivation engine keeps serving the runtimes as they actually are.

## Decision

1. **Adopt Agent Plugins Specification v1.0.0 as the canonical manifest and repo layout.**
   - Canonical manifest: **root `plugin.json`** (was `.plugin/plugin.json`).
   - Canonical skills: **`skills/`** at the root (was `.agents/skills/`). MCP config, if/when handled,
     is **`mcp.json`** at the root.
   - The canonical manifest is **exactly the spec's closed field set**. `universal-plugin` adds **no**
     top-level keys.

2. **All `universal-plugin`-specific config moves under `extensions`, keyed by reverse domain.**
   - Our own tool config (the build-target list formerly `vendors`, and any future tool config) lives
     under **`extensions["org.cyberuni.universal-plugin"]`**.
   - Per-harness data (formerly `vendorExtensions.<harness>`) lives under
     **`extensions["org.cyberuni.universal-plugin"].harnesses.<vendor>`**, keyed by our own vendor id.
     _(Amended 2026-08-09: originally scattered into per-harness reverse-domain namespaces
     `extensions["com.anthropic.claude-code"]`, etc. Reopened during the schema lock — the runtimes
     **never read the canonical `plugin.json`** (see Context; `universal-plugin` derives every
     per-harness manifest), so these blocks are `universal-plugin`'s **own build inputs**, not data a
     harness reads. They belong under the one namespace we own, and `com.*` would mean minting
     reverse-domain strings for vendors we don't control. All `universal-plugin` config — the
     build-target list `vendors`, the `harnesses` override map, `packagePath`, and the component input
     paths — now nests under `org.cyberuni.universal-plugin`.)_
   - `schema/v1.json` is **rewritten**, not patched: it validates the closed spec manifest and defines
     the shape *inside* the `org.cyberuni.universal-plugin` namespace — no sibling
     `vendors`/`vendorExtensions`.

3. **`plugin build` derives one `<harness>/plugin.json` per vendor, with distinct content.** Each
   derived manifest follows **that harness's own** schema (e.g. Claude Code's
   `.claude-plugin/plugin.json`), not the closed canonical schema. The runtimes read these derived
   files, not the canonical root `plugin.json`.

4. **No symlinks — the wiring is derivation.** Because per-harness manifests differ in content, they
   are generated, never linked. `plugin init --npm` (the publish half kept by ADR-0006) therefore
   wires the **derived** `<harness>/plugin.json` paths into `package.json` `files`, so the built
   outputs travel on publish. (The consume-half harness wiring that *would* have used links already
   left to `repobuddy/buddy-agent-harness` under ADR-0006; nothing here revives it.)

## Consequences

- **Breaking, package-wide (~57 files).** Every reference to `.plugin/plugin.json` (build, validate,
  bundle, `publish sync-version`, `cli`, fixtures, tests) and to `.agents/skills/` retargets to the
  root layout; `vendorExtensions` → `extensions["org.cyberuni.universal-plugin"].harnesses`; `vendors`
  → `extensions["org.cyberuni.universal-plugin"].vendors`.
- **`schema/v1.json` rewrite** as in Decision 2. Any uncommitted WIP adding a top-level `"agents"` key
  to the manifest is a **closed-schema violation** and is dropped, not merged.
- **Root `spec.md` revised** — the "canonical `.plugin/plugin.json`" framing, capability map, and
  placement map move to root `plugin.json` + `skills/` + the `extensions` model.
- **`plugin/init/`'s `--npm` scenarios retarget.** ADR-0006 authored them against `.plugin/plugin.json`
  and `.claude-plugin/plugin.json`; the pre-flight now guards the missing `package.json` before writing
  the **root `plugin.json`**, and the derived paths wired into `files` are the build outputs of this
  layout. The node is re-derived (`## Control Flow` + `## Scenario map`) on this canonical.
- **Sequencing.** The canonical migration is a distinct concern from init/setup; it lands as its own
  commit series (PHASE 1) ahead of the `plugin init --npm` node work on CR github-23's branch.

## Alternatives considered

- **Keep `.plugin/plugin.json` canonical; treat the spec as one output target.** Rejected — the schema
  already claims to *be* open-plugin-spec-based; diverging on the canonical path makes that claim false
  and forfeits alignment with the standard the tool bridges to.
- **Keep `vendors`/`vendorExtensions` as top-level keys.** Impossible under the closed field set —
  `additionalProperties: false` rejects them. `extensions` is the only sanctioned channel.
- **Symlink the per-harness manifests to the canonical.** Impossible — the derived manifests have
  different content and different schemas per harness; a link cannot represent that.

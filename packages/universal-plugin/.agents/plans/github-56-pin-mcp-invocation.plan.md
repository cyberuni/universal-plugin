---
cr: github-56
status: active
todos:
  - content: "Spec: revise plugin/build node (README use cases + scenario map) with MCP invocation pinning; add scenarios to build.feature (additive — freeze self-clears)"
    status: completed
  - content: "Spec gate: judge suite + spec, ledger gate line"
    status: completed
  - content: "Impl: src/pin/pin.ts gains the shared runner/specifier parsing + pinMcpServers; extractPins refactored onto it"
    status: completed
  - content: "Impl: build.ts resolves the canonical mcpServers declaration (inline or path), pins marked entries, strips the marker, derives per-vendor mcp.json when it changed"
    status: completed
  - content: "Tests: pin.test.ts units + build.test.ts derivation cases"
    status: completed
  - content: "Impl gate: pnpm verify green, per-scenario verification"
    status: completed
  - content: "Handoff: changeset, PR referencing Closes #56, the two open questions answered in the body"
    status: completed
---

# github-56 — pin an MCP server's `npx` invocation to the plugin's own version

CR: https://github.com/cyberuni/universal-plugin/issues/56
Related: #32 / #1 moved the version through files carrying a `version` **field**; this reaches the one
place they did not — a package specifier inside an `mcpServers` entry's `args`.

## The defect

A plugin whose MCP server is its own npm package writes an unpinned invocation:
`{"command":"npx","args":["-y","cyber-asana","mcp"]}`. A consumer on plugin 0.10.0 gets 0.10.0's
skills and whatever `npx` resolves as latest for the server. Skills and server drift silently.

## Settled design

Same shape as hooks: **author abstractly, stamp concretely at build.**

- The canonical `mcpServers` declaration (`extensions["org.cyberuni.universal-plugin"].mcpServers`)
  is a path, a path list, or an inline block — resolved the way `readCanonicalHooks` resolves hooks.
- An entry opts in with **`"pinToPluginVersion": true`**. Never a name match — a plugin may publish
  its server under a different package name than the plugin's.
- Build rewrites that entry's package specifier in `args` to `<pkg>@<plugin version>` and **strips
  the marker**; the marker is a build directive, not part of any vendor schema.
- Delivery follows the hooks rule: nothing marked → the declaration passes through as authored, no
  derived file. Something marked → the pinned, marker-stripped map is delivered — inline when the
  canonical declared it inline, else as `<vendor-dir>/mcp.json` with `mcpServers` repointed there.
  The authored file is never rewritten.
- `copilot-cli` reads the canonical manifest directly, so there is no derived manifest to repoint —
  the build warns that the pin is not delivered, the same remedy ADR-0011 uses for its hook drops.
- The specifier matcher is **reused from `src/pin/pin.ts`**, not re-derived: the runner words
  (`npx`/`upx`), the `-y` / `--yes` spellings, and the scoped-name `@` split live there once and
  `extractPins` is refactored onto them.

Guards (warn, leave the entry untouched, build stays green): `command` is not a runner word; the
manifest carries no `version`; no package specifier found in `args`.

## Open questions — resolved

1. **An already-pinned specifier is overwritten**, with a warning when the authored version differs
   from the plugin version. The marker declares that this package's version *is* the plugin's, and a
   version is derived-never-authored (ADR-0010 §1). Leaving it would fork a second writer and
   reintroduce the drift the feature closes; rejecting would fail a dev-time build that runs
   constantly and has one obvious correct answer.
2. **`plugin doctor` does not warn** on an unpinned self-invocation carrying no marker. Doctor would
   have to name-match to find one, and unsound name-matching is the exact reason the marker exists —
   it would fire on `npx -y widget-cli`. A narrow check (args package equals the `packagePath`
   package name) is defensible but is a separate node's change; recorded as a follow-up.

## NEXT

Landed. `plugin build` stamps a marked `mcpServers` invocation with the manifest version and strips
the marker from everything derived; the pin domain owns the runner/specifier matcher for both its
callers. Sixteen additive scenarios in `build.feature` (still `@frozen`, zero deletions), the node
README and the root placement map revised, a row added to the version-policy decision's
derived-vs-authored table, and the marker documented in the shipped authoring governance and the docs
site. Both gates approved by cold judges: the spec gate on round 3 (rounds 1–2 blocked on a governance
relay, a missing positive companion for the second runner word, and a closure claim contradicting the
node's own catalog-refresh behavior), the impl gate on round 2 (round 1 blocked on an apparatus
literal reused in rationale prose). Repository verification green at 620 tests. No resume action
remains.

# github-23 — settled design (adopt as draft on resume)

Captured from a design session so the resuming conductor adopts these as **settled** and grills only
the open spec/scenario details, not the decisions below. CR body: issue #23.

## Decision: init/setup belongs to universal-plugin (charter change)

The split holds on the **inbound/outbound** line:

- **universal-plugin = author/build toolchain** — derive, validate, resolve governance, **and set up
  the repo/project you author in** (local, deterministic scaffolding — an extension of `plugin init`).
- **cyberplace = distribution/runtime** — publish *to* / install *from* the marketplace, lifecycle hooks.

ADR-0001's "marketplace / plugin-install → cyberplace" line is **unchanged**; this CR only adds
"repository/project init & setup" as a third universal-plugin concern. Needs a new ADR (revise 0001)
+ root `spec.md` revision before node placement.

## Scope: both facets (confirmed)

### Facet 1 — repo-level canonical `.agents/` + harness compatibility
- Canonical dir: `.agents/skills/`. (agentskills.io specs only the skill *format*; `.agents/skills/`
  is the ecosystem de-facto convention from `vercel-labs/skills`.)
- Symlink mechanics — mirror `vercel-labs/skills` exactly:
  - Universal harnesses (Cursor, Codex, Copilot, OpenCode, …) read `.agents/skills/` directly → **no
    link**.
  - Non-universal (Claude Code, Windsurf, …) get a **relative** symlink
    `<harness>/skills/<name>` → `../../.agents/skills/<name>`, with **copy fallback** (failure/Windows).
  - Do **not** create a harness dir that doesn't already exist — **except `claude-code`, always linked**.
- Record enabled harnesses **per-repo** in `.agents/universal-plugin.json` (the `config` domain's file).
  `skills` only records this globally (`lastSelectedAgents`) — per-repo is our improvement.

### Facet 2 — an npm package can ship an agentic plugin
- Scaffold canonical `.plugin/plugin.json` (reuse `plugin init`); wire `package.json` `files` to ship
  the **built** vendor manifest(s).
- Consumption target = Claude Code npm plugin source:
  `{"source":"npm","package":"<pkg>","version?":"...","registry?":"..."}` (installed via `npm install`).
  Claude reads the manifest from **`.claude-plugin/plugin.json`** inside the package — Claude's derived
  path, distinct from canonical `.plugin/plugin.json`. So `plugin build` must emit
  `.claude-plugin/plugin.json` and `files` must include it.
- Caveat: **npm sources are not allowed for org-distributed (Team/Enterprise) marketplaces** —
  public/personal only.
- Monorepo: runs per-package.

### Gateway skill
Interactive orchestrator; keeps interactivity **out** of the CLI (AXI non-interactive contract).
Detect installed harnesses → multi-select (universal ones in a locked "Universal (.agents/skills)"
group, à la `npx skills`) → explain the standard → shell out to `universal-plugin init --harness …`.

### Dogfood
Make `packages/universal-plugin` itself a plugin: `skills/init/SKILL.md` + own `.plugin/plugin.json`;
derives clean via `plugin build`.

## CLI shape
`universal-plugin init [--harness <id>]… [--detect] [--all] [--copy] [--root <path>] [--force]` —
non-interactive default, TOON + `--format json`, fail-loud unknown flags, next-step stderr line,
`--help`, idempotent.

## Non-goals
Marketplace publish/install + lifecycle hooks (cyberplace); the `marketplace.json` catalog itself
(deferred); authoring-skill content (cyberspace/aced).

## Open (grill these on resume)
- Node placement (capability-first): top-level `init/` vs sub-node; relation/naming vs frozen
  `plugin/init/` (avoid collision — this is repo/project setup, that is manifest scaffold).
- Is facet-2's `package.json` wiring part of `init`, or a distinct verb?
- Detection heuristics per harness (which config dirs signal "installed").

## Provenance
Research on `vercel-labs/skills` mechanics and `npx skills` flow, and Claude Code npm plugin source,
was done in the originating session; findings summarized above.

# Plugin Design Governance

Normative rules for universal plugin authors and skills that scaffold or audit plugins.

## Component selection

- Use `skills/` as the default capability unit — it is the only component guaranteed to work on all Tier 1 vendors.
- Use `mcpServers` (`.mcp.json`) as the primary cross-vendor integration layer for external tools and APIs.
- Use `commands/` and `agents/` for Claude Code, Cursor, and Copilot CLI; omit or note as unsupported for Codex.
- Use `rules/` only for always-on guidance that is Cursor-specific. For guidance that must work in Claude Code, write to `AGENTS.md` instead.
- Always pair `rules/` with a `commands/setup.md` that merges rule content into the project's `AGENTS.md` — this is the cross-vendor always-on path.
- Use `hooks/` only when behavior must be triggered at a lifecycle event. Prefer skills for on-demand workflows.

## Hook authoring

- Write hook event names in PascalCase canonical form in `hooks/hooks.json` — the build translates per vendor.
- Use `${PLUGIN_ROOT}` and `${PLUGIN_DATA}` in hook commands — the build substitutes vendor-specific names.
- Extract shared hook logic into `hooks/<impl>.sh`; keep `hooks.json` as the declaration layer only.

## Vendor extensions

- An empty `{}` in `vendorExtensions` opts into that vendor's build output with no vendor-specific fields — use it to include a vendor without adding marketplace fields yet.
- Put marketplace metadata (logo, category, tags, publisher) in `vendorExtensions.<vendor>`, not in the canonical fields.
- Do not put vendor-specific hook schemas or env var overrides in canonical `hooks.json` — use `vendorExtensions.<vendor>.hooks` for vendor-native overrides.

## Build artifacts

- Never hand-edit `.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/`, or the root `plugin.json` (copilot-cli) — these are build outputs.
- Gitignore generated vendor manifests. Only commit the canonical `plugin.json`.

## Anti-patterns

- Do not embed vendor-specific hook event casing (camelCase, snake_case) in canonical `hooks/hooks.json`.
- Do not rely on `rules/` for Claude Code users — Claude Code does not read `.mdc` rules files.
- Do not use `${CLAUDE_PLUGIN_ROOT}` or `${CURSOR_PLUGIN_ROOT}` in canonical paths — use `${PLUGIN_ROOT}`; the build translates.
- Do not commit generated manifests — they drift from the canonical definition and create merge conflicts.

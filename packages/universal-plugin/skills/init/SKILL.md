---
name: init
description: Use this skill to create or change a universal agent plugin — scaffold a new one, adopt an existing vendor-specific plugin or already-shipped skills onto the open Agent Plugins Specification, or add and remove vendors and components on the canonical plugin.json that drives Claude Code, Cursor, Codex, and GitHub Copilot CLI. Trigger on "init a plugin here", "make my Claude Code plugin work in Cursor", "convert this to the open plugin standard", "turn these skills into a plugin", "add Codex support", or "add a hooks component".
argument-hint: '[--name <name>] [--vendor <id>] [--scaffold] [--npm] [--force]'
---

# Plugin Init

Give a project one canonical plugin manifest — a root `plugin.json` on the Agent Plugins
Specification — and derive from it the manifest each runtime expects.

Most of the manifest is shared. The divergence is small and asymmetric: Copilot CLI reads the
canonical `plugin.json` directly and gets no derived file at all, while Claude Code, Cursor, and
Codex each read their own path. Keep that asymmetry in mind — this is a consolidation job, not a
copy-everywhere job.

`references/standard.md` defines the baseline every plugin gets. Read the vendor file for each
runtime you are enabling, and only those.

| Vendor | Derived manifest | Extra requirements | Read |
| --- | --- | --- | --- |
| Claude Code | `.claude-plugin/plugin.json` | none | `references/vendors/claude-code.md` |
| Cursor | `.cursor-plugin/plugin.json` | none | `references/vendors/cursor.md` |
| Codex | `.codex-plugin/plugin.json` | `version`, `description` | `references/vendors/codex.md` |
| GitHub Copilot CLI | none — reads root `plugin.json` | none | `references/vendors/copilot-cli.md` |

This skill owns the **authoring** side: the plugin a project ships. Setting a repository up to
*consume* skills — the `.agents/skills/` layout, `AGENTS.md`, per-harness bridges — is
`buddy-agent-harness:init`, not this.

## Prerequisites

Load the component-selection governance before any work that adds or removes components:

```bash
npx universal-plugin governance show plugin-design
```

It is the authoritative source for which component to reach for and which anti-patterns to avoid.

## Arguments

An invocation may carry the CLI's own flags: `/universal-plugin:init --name my-plugin --scaffold --npm`.

Read them from the invocation itself rather than from a placeholder. Claude Code appends what the
caller typed as `ARGUMENTS: <value>`, and Codex substitutes nothing at all, so on every runtime the
flags arrive as text you can read. Writing `$ARGUMENTS` into this body would resolve on Claude Code
and stay literal everywhere else.

- `--name`, `--vendor`, `--scaffold`, `--force`, `--npm`, and `--root` pass through to
  `universal-plugin plugin init` in Phase 4.
- Prose carries the same weight: "ship it on npm" means `--npm`, "overwrite what's there" means
  `--force`.
- An argument never skips a phase. `--force` still needs the Phase 3 approval, and the survey still
  runs first.
- Say what you did not recognize and carry on. Never guess at a flag.

Work in five phases. Do not skip Phase 3.

## 1. Survey

Locate the plugin root — the directory that holds, or will hold, the canonical `plugin.json`. In a
monorepo that is usually the package that ships the plugin, not the repository root; `migrate-plugin`
covers moving one that sits in the wrong place.

Inventory both the canonical surface (root `plugin.json`, its `extensions` block, the component
directories it names) and every pre-existing vendor artifact listed in `references/detection.md`.
Read what you find. Write nothing yet.

## 2. Classify

Sort each finding into exactly one bucket:

- **canonical** — a root `plugin.json` with `$schema` on `agent-plugins.org` and an `extensions`
  object. This is the source of truth; every edit lands here.
- **derived** — `.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/` manifests that `plugin build`
  regenerates. Rebuild them; never hand-edit them.
- **adoptable** — a hand-written vendor manifest with no canonical manifest above it, a legacy root
  `plugin.json` carrying neither `$schema` nor `extensions`, or publicly-shipped skills with no
  manifest at all. These become canonical content in Phase 4.
- **undeliverable** — a vendor-specific field with no delivery path, most often a
  `harnesses["copilot-cli"]` override: the canonical schema is closed, so the field cannot ride
  along in root and the build warns about it. Report; do not invent a home for it.
- **not a plugin** — repo-private agent configuration (`.claude/skills/`, `.agents/skills/`,
  `.cursor/rules/`). It is this project's own tooling, not something it distributes. Say nothing
  about packaging it.

`references/detection.md` maps each signal to its bucket, and draws the public-versus-private line
that decides the last two.

## 3. Confirm

Present the plan before touching anything the user wrote: which files will be created, which
hand-written vendor manifests become generated artifacts, which vendors will be enabled, what the
canonical metadata will say (show `name`, `version`, and `description` verbatim), and what is being
left alone and why.

Get explicit approval before any step that deletes, replaces, or rewrites a user-authored file —
adoption always crosses that line, because it turns manifests the user maintains into build output.
Creating a missing `plugin.json`, a missing component directory, or a missing skill scaffold needs
no approval; report those rather than asking.

One case needs asking even when nothing is overwritten: two vendor manifests that disagree on a
shared field. A silent pick there is a silent behavior change for one runtime.

## 4. Apply

Route by what Phase 2 found. Read exactly the reference for the work at hand — do not load all six.

| What Phase 2 found | Do this | Reference |
| --- | --- | --- |
| nothing — greenfield | scaffold a canonical manifest and its components | [`references/create.md`](./references/create.md) |
| adoptable | carry it onto the canonical manifest, losslessly | [`references/adopt.md`](./references/adopt.md) |
| canonical, and a vendor or component changes | edit `extensions`, then rebuild | [`references/update.md`](./references/update.md) |

Three asks leave this skill rather than routing inside it. Hand them over instead of improvising a
route: **`doctor`** reports what is declared, built, stale, or drifting; **`version`** moves the
number; **`remove-plugin`** deletes derived manifests or the plugin itself.

Every route ends in the same two commands. Scaffold with the CLI that shipped beside this skill:

```bash
node scripts/init.mjs --name <plugin-name> --vendor claude-code --vendor cursor
```

Resolve that path against this skill's own directory. The launcher runs the bundled CLI, so nothing
is downloaded; fall back to `npx universal-plugin plugin init` when the path cannot be resolved.
`plugin init` never prompts, so it is safe to run unattended (`--yes` is accepted as a no-op).

Then derive the vendor manifests:

```bash
npx universal-plugin plugin build
```

`plugin init` writes a **minimal** manifest — `$schema`, `name`, and the vendor list. It never reads
an existing vendor manifest, so shared metadata and per-vendor overrides are carried in by hand
afterwards, per the reference you routed to.

If the request spans more than one route ("add Codex, then cut a release"), take this skill's part
first and hand the rest to the skill that owns it. If the route is unclear, ask which the user means
rather than guessing.

## 5. Verify and report

Confirm the build wrote what the manifest declares: one file per derived vendor, `canonical` status
and no file for Copilot CLI. Read the build's warnings — an unknown vendor id and an undeliverable
override both surface there and both are silent capability loss if ignored.

When the work was an adoption, the proof is the diff:

```bash
git diff -- .claude-plugin .cursor-plugin .codex-plugin .github/plugin
```

Expect only formatting and key-order churn. Any field that disappeared is a regression, not a
cleanup — trace it back to the shared metadata or to that vendor's `harnesses` entry before shipping.

Audit each skill the plugin ships, per [`references/create.md`](./references/create.md) Step 6.
Report what was created, adopted, derived, and left alone. For a fuller read of the plugin's state
than this phase gives — drift, version skew, shadowing manifests — hand off to `doctor`.

This skill is not a formatter. If the project has one, run it over the written files and say so.

## Rules

- **Edit the canonical manifest, never a derived one.** `.claude-plugin/plugin.json` and its
  siblings belong to `plugin build`; a hand-edit there is overwritten on the next build.
- **Never hand-edit a `version` field.** Two authored files and every derived artifact fall out of
  sync. The `version` skill owns that move.
- **Adoption is lossless by contract.** Every vendor that worked before must still work after, and
  the Phase 5 diff is the check that proves it.
- **Do not package repo-private agent configuration.** A `.claude/skills/` directory is the project's
  own tooling; offering to publish it is wrong.
- **Do not convert vendor settings without a documented mapping.** Hook event names diverge by case
  across runtimes and the build does not translate them today — see
  `references/vendors/claude-code.md`. Unmapped settings stay where they are, reported.
- **Offer adoption once.** If the user declines, or asked for something unrelated, drop it and do
  what they asked.
- Plugin authoring only. Do not change CI workflows, repository settings, or unrelated project files.

## Related skills

| Task | Skill |
|------|-------|
| Diagnose a plugin — what is declared, built, stale, or drifting | `doctor` |
| Make the repository installable, and document how | `marketplace` |
| Move the plugin's version, or reconcile one that drifted | `version` |
| Delete derived manifests, or the whole plugin | `remove-plugin` |
| Move a repo-root plugin into its npm package | `migrate-plugin` |
| Publish a packaged plugin to the marketplace | `publish-plugin` |
| Bump the pinned `universal-plugin@<version>` the project *calls* (not the plugin's own version) | `upgrade-plugin` |
| Rewrite `npx` pins to the `upx` runner | `adopt-upx` |
| Set a repository up to *consume* skills (`AGENTS.md`, `.agents/skills/`) | `buddy-agent-harness:init` |

## References

- Governance: `npx universal-plugin governance show plugin-design`
- Spec: https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/spec.md
- Schema: https://raw.githubusercontent.com/cyberuni/universal-plugin/refs/heads/main/schema/v1.json
- Examples: https://github.com/cyberuni/universal-plugin/tree/main/examples

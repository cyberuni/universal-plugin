# Adopt the open standard

Convert something that is *already* a plugin — or already ships skills — onto the canonical
Agent Plugins Specification manifest, without changing what it does.

Two starting shapes land here:

- **A vendor-specific plugin** — it has one or more hand-written vendor manifests
  (`.claude-plugin/plugin.json`, `.cursor-plugin/plugin.json`, …) and no canonical root
  `plugin.json`.
- **Bare public skills** — it ships `skills/<name>/SKILL.md` to users but has no plugin manifest of
  any kind.

Adoption is **lossless by contract**: every vendor that worked before must still work after. Step 6
is the check that proves it — do not skip it.

## Step 0 — Confirm the user wants this

This is the skill's Phase 3 gate, and adoption always needs it: adoption rewrites the project's
manifest layout and turns hand-written vendor manifests into generated artifacts. Say that plainly
and get agreement before touching files. If the user declines,
route back to whatever they originally asked for.

Also confirm the working tree is clean (`git status`). The Step 6 diff is worthless if uncommitted
changes are mixed in.

## Step 1 — Inventory what exists

```bash
ls -d .claude-plugin .cursor-plugin .codex-plugin .github/plugin .plugin 2>/dev/null
test -f plugin.json && cat plugin.json
find . -name SKILL.md -not -path '*/node_modules/*' -not -path './.git/*'
ls .mcp.json .lsp.json hooks/ commands/ agents/ rules/ output-styles/ 2>/dev/null
```

Record, for each vendor manifest found: its path, and every field it sets. You are about to
reproduce all of it.

**If a root `plugin.json` already exists**, read it before assuming anything. It is either the
canonical manifest (has `$schema` pointing at `agent-plugins.org` and an `extensions` object — in
which case there is nothing to adopt; route to `update.md` or `inspect.md` instead), or a legacy
Copilot CLI manifest that now collides with the canonical path and must be folded in.

## Step 2 — Sort every field into shared vs vendor-specific

Build two buckets from the manifests you inventoried:

- **Shared metadata** — `name`, `version`, `description`, `author`, `homepage`, `repository`,
  `license`, `keywords`, and the component paths. These go at the canonical top level.
- **Vendor-specific** — anything only one runtime understands (Cursor's `publisher`/`category`/
  `tags`, Codex's `interface`, Copilot's `category`/`tags`). These go under
  `extensions["org.cyberuni.universal-plugin"].harnesses.<vendor>`.

Where two vendor manifests disagree on a shared field, **ask the user** which value is canonical
rather than picking one. A silent choice here is a silent behavior change for one of their runtimes.

## Step 3 — Write the canonical manifest

Scaffold it, naming exactly the vendors you found in Step 1:

```bash
node scripts/init.mjs --name <name> --vendor claude-code --vendor cursor
```

Resolve `scripts/init.mjs` against this skill's directory; `npx universal-plugin plugin init` is the
fallback.

> `plugin init` writes a **minimal** manifest — `$schema`, `name`, and the `vendors` list. It does
> not read your existing vendor manifests. Carry the Step 2 buckets in by hand afterwards.

Then fill in the shared metadata and `harnesses` as laid out in
[`create.md`](./create.md) Step 5. Point the component paths at the directories that already exist —
adoption must not move files.

For the bare-public-skills case there is no metadata to carry over; supply `name`, `description`,
and `version`, set `"skills": "./skills/"`, and choose vendors with the user (see
[`create.md`](./create.md) Step 2).

## Step 4 — Decide what happens to the old manifests

The vendor manifests are now **build outputs**. They stay at the same paths, but they are
regenerated rather than edited.

- Commit them as-is first, so Step 6 has a baseline to diff against.
- Tell the user they are generated from here on, and that hand-edits will be overwritten by
  `plugin build`.
- If the project has a legacy root `plugin.json` for Copilot CLI, that path is now the canonical
  manifest — its derived Copilot output moves elsewhere. Check the vendor output table in
  [`create.md`](./create.md) Step 2 for the current path.

## Step 5 — Build

```bash
npx universal-plugin plugin build
```

## Step 6 — Prove it was lossless

This is the point of the whole procedure.

```bash
git diff -- .claude-plugin .cursor-plugin .codex-plugin .github/plugin
```

Read every line of that diff. Expect only formatting and key-order churn.

**Any field that disappeared is a regression**, not a cleanup. Trace it back: either it belongs in
the shared metadata, or it belongs in that vendor's `harnesses` entry, or it is a field the build
does not yet support — in which case stop and tell the user rather than shipping a quiet
capability loss.

Then confirm the plugin still loads. See [`create.md`](./create.md) Step 8 for local install.

## Step 7 — Hand off

- Audit the skills: [`create.md`](./create.md) Step 6.
- Shipping it on npm? → `migrate-plugin`.
- Listing it in the marketplace? → `publish-plugin`.

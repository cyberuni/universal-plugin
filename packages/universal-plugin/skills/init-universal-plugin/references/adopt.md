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
which case there is nothing to adopt; route to `update.md`, or hand off to `doctor`, instead), or a legacy
Copilot CLI manifest that now collides with the canonical path and must be folded in.

## Step 2 — Sort every field into shared, vendor-specific, and undeliverable

Build three buckets from the manifests you inventoried:

- **Shared metadata** — the canonical top level is a **closed** set of exactly ten fields:
  `$schema`, `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`,
  `keywords`, `extensions`. A field in that list stays at the top level. That set is the upstream
  spec's, not this project's — see
  [the published schema](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json).
- **Vendor-specific** — anything only one runtime understands (Cursor's `publisher`/`category`/
  `tags`, Codex's `interface`). These go under
  `extensions["org.cyberuni.universal-plugin"].harnesses.<vendor>`. The component paths
  (`skills`, `commands`, `agents`, `hooks`, `mcpServers`, `rules`, `lspServers`, `outputStyles`)
  are not top-level either — they go under that same extension namespace, one level up from
  `harnesses`.
- **Undeliverable** — a field whose only consumer is Copilot CLI. Copilot CLI reads the canonical
  root manifest directly and gets no derived file, so such a field has no home on either side: the
  closed schema rejects it at the top level, and a `harnesses["copilot-cli"]` entry is never
  written anywhere. Before dropping one, check
  [`vendors/copilot-cli.md`](./vendors/copilot-cli.md) — the two fields that actually turn up here,
  `category` and `tags`, have a spec-conformant home (`keywords`) and are not a loss.

Where two vendor manifests disagree on a shared field, **ask the user** which value is canonical
rather than picking one. A silent choice here is a silent behavior change for one of their runtimes.

### Name every field you are about to drop

A legacy root `plugin.json` is what makes the third bucket real. Before 0.6 the build wrote
Copilot CLI's output *to root*, so root carries whatever Copilot-specific fields the project set —
`category` and `tags` are the ones seen in the wild. After adoption root is the canonical manifest
and those fields have nowhere to go.

Nothing warns about this. The build's `undeliverable-override` warning and `doctor`'s matching
finding fire only on a `harnesses["copilot-cli"]` entry — which is what someone doing it *wrong*
writes. An adoption done correctly never creates one, so it gets silence. Enumerate the fields
yourself, from the pre-adoption root manifest, before you overwrite it:

```bash
node -e '
  const spec = ["$schema", "name", "version", "description", "author",
                "homepage", "repository", "license", "keywords", "extensions"]
  const root = JSON.parse(require("node:fs").readFileSync("plugin.json", "utf8"))
  for (const k of Object.keys(root)) {
    if (!spec.includes(k)) console.log(k, "=", JSON.stringify(root[k]))
  }
'
```

Every name it prints is a field the canonical top level cannot hold. Sort each one:

| The field | Where it goes |
| --- | --- |
| `vendorExtensions` — the whole pre-0.6 block | `extensions["org.cyberuni.universal-plugin"].harnesses` — **renamed, not dropped** |
| a component path (`skills`, `commands`, `agents`, …) | `extensions["org.cyberuni.universal-plugin"].<name>` — carried |
| a field a vendor with a *derived* manifest understands | that vendor's `harnesses` entry — carried |
| `category` / `tags` from the legacy Copilot output | fold into **`keywords`** — see below |
| anything left | **dropped** |

`vendorExtensions` is the row that catches people out, because the snippet prints it alongside the
genuinely undeliverable fields and it looks like one of them. It is not: it is the old name for
`harnesses`, and dropping it discards every per-harness override the project had. Carry the block
across, then sort the `copilot-cli` entry inside it by the rule above — that entry is the one whose
contents have no delivery path.

`plugin build` will not let this one pass quietly: a root manifest still carrying `vendorExtensions`
now exits 1 rather than reporting `built 0`, naming the signal and routing to `doctor`. If Step 5
fails that way, the block did not get carried across.

`category` and `tags` have their own row because they are the fields this whole step exists for, and
they are **not** simply dropped. Copilot CLI has no `plugin.json` handling for either — its manifest
validator knows `keywords` and treats these two as unknown-and-ignored — while `keywords` is both a
spec field and the one Copilot actually parses. So fold the values in rather than deleting them:

```
category: "productivity" + tags: ["workflow", "planning", "verification"]
  → keywords: ["productivity", "workflow", "planning", "verification"]
```

If the project also ships a `marketplace.json` catalog, `category` and `tags` are real fields on a
catalog entry and belong there as well — with the right types, because a wrong one is a fatal browse
error rather than a warning. [`vendors/copilot-cli.md`](./vendors/copilot-cli.md) has the evidence
and the exact validator messages.

**Report anything genuinely dropped to the user by name, with the value each held, before Step 3
writes anything.** That report is the only notice they get, and it is the difference between an informed
decision and a field that evaporates. Say what the field was for if you know; if a field looks load-
bearing and the user wants it kept, stop rather than shipping the adoption around it.

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
  manifest. Copilot CLI gets no replacement file: it reads root directly, so the canonical manifest
  *is* its manifest from here on. See the vendor output table in [`create.md`](./create.md) Step 2.

## Step 5 — Build

```bash
npx universal-plugin plugin build
```

## Step 6 — Prove it was lossless

This is the point of the whole procedure.

```bash
git diff -- plugin.json .claude-plugin .cursor-plugin .codex-plugin .github/plugin
```

Root `plugin.json` is in that list on purpose, and it is the one path that behaves differently from
the other four.

- For `.claude-plugin`, `.cursor-plugin`, `.codex-plugin`, and `.github/plugin`, expect only
  formatting and key-order churn. A hunk that changes a value is a finding.
- For root `plugin.json`, **expect real hunks** — the `$schema` line and the `extensions` object are
  new, and the component paths moved under them. That is the rewrite working. Because the diff is
  large by design it is the easy one to skim, and under the legacy layout root *was* a vendor
  manifest — Copilot CLI's — so it is also the only file where a field can go missing without any
  other check noticing. Read it, do not skim it.

Account for **every key that leaves root**. Each one must land in exactly one of three places: at the
canonical top level, under `extensions`, or on the dropped list you enumerated and reported in
Step 2. A key that left root and is on none of those three is a regression.

**Any field that disappeared unannounced is a regression**, not a cleanup. Trace it back: either it
belongs in the shared metadata, or it belongs in that vendor's `harnesses` entry, or it is a field
the build does not yet support — in which case stop and tell the user rather than shipping a quiet
capability loss.

Then confirm the plugin still loads. See [`create.md`](./create.md) Step 8 for local install.

## Step 7 — Hand off

- Audit the skills: [`create.md`](./create.md) Step 6.
- Shipping it on npm? → `migrate-plugin`.
- Listing it in the marketplace? → `publish-plugin`.

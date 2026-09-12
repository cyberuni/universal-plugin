# Create a universal plugin

Scaffold a new plugin from one canonical `plugin.json` and derive a manifest per chosen vendor.

## Step 1 — Gather plugin identity

Ask for what is missing. Every field lands at the canonical top level.

| Field | Required | Notes |
|-------|----------|-------|
| `name` | Yes | kebab-case, 1–64 chars, `a-z 0-9 - .` only |
| `description` | Recommended | one sentence; **required** when targeting Codex |
| `version` | If publishing | semver; **required** when targeting Codex |
| `author.name` | Recommended | person or org name |
| `homepage` | Optional | docs or landing page URL |
| `repository` | Optional | source repo URL |
| `license` | Optional | SPDX identifier, e.g. `MIT` |
| `keywords` | Optional | discovery tags; array of strings |

## Step 2 — Choose vendor targets

Ask which runtimes to support; default to all four if the user is unsure. Each choice becomes an
entry in both `vendors` and `harnesses` under
`extensions["org.cyberuni.universal-plugin"]`.

| Vendor ID | Derived manifest | Read before enabling |
|-----------|------------------|----------------------|
| `claude-code` | `.claude-plugin/plugin.json` | [`vendors/claude-code.md`](./vendors/claude-code.md) |
| `cursor` | `.cursor-plugin/plugin.json` | [`vendors/cursor.md`](./vendors/cursor.md) |
| `codex` | `.codex-plugin/plugin.json` | [`vendors/codex.md`](./vendors/codex.md) |
| `copilot-cli` | none — reads root `plugin.json` | [`vendors/copilot-cli.md`](./vendors/copilot-cli.md) |

## Step 3 — Choose components

Infer from context; ask only if ambiguous. [`standard.md`](./standard.md) has the component table and
the layout they go in; `governance show plugin-design` decides which component a given need calls
for. The universal minimum is `skills/<name>/SKILL.md` plus `.mcp.json`.

## Step 4 — Scaffold

```bash
node scripts/init.mjs --name <plugin-name> --vendor claude-code --vendor cursor --scaffold
```

Resolve `scripts/init.mjs` against this skill's directory; it runs the CLI that shipped beside it.
`npx universal-plugin plugin init` is the fallback. Add `--npm` when an npm package ships the plugin,
which also wires that `package.json`'s `files` to carry the derived manifests.

`init` writes a minimal manifest — `$schema`, `name`, and the vendor list. Fill in the Step 1
metadata and the `harnesses` overrides by hand afterwards; [`standard.md`](./standard.md) shows the
finished shape.

Then create the component files from `../assets/templates/`:

| File to create | Template |
|----------------|----------|
| `skills/<name>/SKILL.md` | `assets/templates/skill.md` |
| `commands/<name>.md` | `assets/templates/command.md` |
| `agents/<name>.md` | `assets/templates/agent.md` |
| `hooks/hooks.json` | `assets/templates/hooks.json` |
| `commands/setup.md` (only with `rules/`) | `assets/templates/setup-command.md` |

## Step 5 — Fill in the harness overrides

Only fields one runtime understands go here; shared metadata stays at the top level. See each
`vendors/<vendor>.md` for what that vendor accepts, and note that a `copilot-cli` entry has no
delivery path at all.

```json
"harnesses": {
  "claude-code": {},
  "cursor": { "publisher": "<org>", "category": "<category>", "tags": ["<tag>"] },
  "codex": { "interface": { "displayName": "<Human Name>", "category": "<category>" } },
  "copilot-cli": {}
}
```

## Step 6 — Audit the skills

Run the mechanical validator from the aced **improve-skill** skill:

```bash
node "<path to aced improve-skill>/scripts/validate.mts" --path skills/<skill-name>
```

Fix every CRITICAL finding, then invoke the **audit-skill** skill for the full review.
[`frontmatter.md`](./frontmatter.md) covers what has to hold across runtimes.

## Step 7 — Build

```bash
npx universal-plugin plugin build
```

Useful flags: `--dry-run` to see the plan, `--verbose` for field-by-field decisions, `--vendor <id>`
for one target, `--clean` to delete derived manifests first.

Read the warnings. An unknown vendor id, an undeliverable Copilot override, and a failed Codex prompt
write all surface there rather than as errors.

## Step 8 — Install locally to test

```bash
npx universal-plugin plugin install
```

It installs into every runtime the manifest declares, linking where the runtime follows a symlink
out of the tree and copying where it does not, and it prints the reload each one now needs — a
restart for Claude Code, **Developer: Reload Window** for Cursor. `--list` shows where it would go
without writing; `--vendor <id>` narrows it; `plugin uninstall` removes it again.

Codex and Copilot CLI scan no local plugin directory, so they report as `unsupported`. Reach those
through a repository-local marketplace — `publish-plugin`.

Do not hand-write a symlink for this. The recipe that circulated for it named
`~/.claude/plugins/local/`, which does not exist, and a symlink into Cursor's local directory is
rejected by Cursor's own scan.

## Next

Shipping it on npm → `migrate-plugin`. Listing it in a marketplace → `publish-plugin`. Releasing a
number → `/universal-plugin:version`.

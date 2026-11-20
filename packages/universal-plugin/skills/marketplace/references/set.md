# Route: set

Change the catalog's own top-level fields in place, and keep everything else: the dependency
allowlist, the owner, the description. An entry is `update`'s (`references/update.md`).

## 1. Work out the change

| The user wants | Flags | Catalogs |
| --- | --- | --- |
| Allow dependencies on another marketplace | `--allow-dependencies-on <marketplace>`, repeatable | Claude only |
| Stop allowing one | `--disallow-dependencies-on <marketplace>`, repeatable | Claude only |
| Describe the catalog | `--description` | Claude, Copilot, Cursor |
| Name the owner | `--owner`, `--owner-email`, `--owner-url` | Claude, Copilot, Cursor |
| Remove a field | `--unset description`, `owner.email`, `owner.url`, or `allowCrossMarketplaceDependenciesOn` | as above |

The allowlist is Claude-only because Claude Code is the only runtime that resolves dependencies.
Codex carries none of these fields, so its catalog is reported `skipped`. An empty allowlist drops
the key, and a new key is written before `plugins`.

## 2. Preview, then write

```bash
node <this skill's folder>/scripts/universal-plugin.mjs marketplace set --allow-dependencies-on cyberplace --dry-run
```

Resolve that path against this skill's own directory. Run `--dry-run` first and show the plan. The command never prompts.

| Status | Means |
| --- | --- |
| `updated` | the catalog changed; the row's `fields` name what |
| `unchanged` | already says exactly this |
| `planned` | `--dry-run` only |
| `skipped` | that catalog is missing or its runtime carries none of the fields; the reason says which |

Report each skip with its reason.

## 3. Validate

Every catalog is validated before it is written, so the write is safe. Follow
`references/validate.md` and report its result, not just the change's.

Then state plainly that nothing was published: the change sits in the repository until it is pushed
and a user refreshes the marketplace.

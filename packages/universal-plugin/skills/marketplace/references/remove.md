# Route: remove

Drop one entry from every catalog that lists it, and keep everything else. This is the route for a
plugin that should no longer be listed: delisted, deprecated, or added by mistake.

An entry that should change, not go, is `update`'s (`references/update.md`).

## 1. Name the entry

Use the name the catalogs list it under. With no target flags all four catalogs are selected. Add
`--claude`, `--codex`, `--copilot`, or `--cursor` to limit the removal.

## 2. Preview, then write

```bash
node <this skill's folder>/scripts/universal-plugin.mjs marketplace remove repobuddy --dry-run
```

Resolve that path against this skill's own directory. Run `--dry-run` first and show the plan. The command never prompts.

| Status | Means |
| --- | --- |
| `removed` | the entry is gone from that catalog |
| `planned` | `--dry-run` only |
| `skipped` | that catalog is missing or does not list the entry; the reason says which |

A `skipped` row for a catalog that never listed the entry is normal. Report each skip with its
reason. When no selected catalog lists the entry, the command errors; say so and check the name.

## 3. Handle what the command flags

- **A listed plugin depends on the entry.** The command stops and writes nothing. Name the dependent
  plugin and ask. `--force` removes the entry anyway and warns; use it only when the user accepts
  that the dependent plugin will no longer install from this marketplace.
- **The `./` path still holds a `plugin.json`.** The command warns that `plugin build` or
  `marketplace init` will list the plugin again. Tell the user to delete the directory or drop it
  from the scan; this skill does not delete it.

## 4. Validate

Every catalog is validated before it is written, so the write is safe. Follow
`references/validate.md` and report its result, not just the removal's.

Then state plainly that nothing was published: the entry stays installable until the change is
pushed and users refresh the marketplace.

# Route: update

Change one entry the catalogs already list, and keep everything else about it. This is the route
for an entry that is listed and wrong or stale: a new source, a moved pin, one field.

`add --force` is not a substitute. It replaces the entry with what `add` can derive, so it needs
`--owner` and the other `add` inputs again, and it drops what it cannot derive: `category`,
`author`, any field a curator wrote by hand. Use `update` whenever the entry already exists.

An entry that is not listed yet is `add`'s (`references/add.md`). A plugin this repository holds is
re-derived by `init` or `plugin build`; reach for `update` there only for a field neither derives,
such as `category`.

## 1. Work out the change

Name the entry by the name the catalogs list it under, then say what changes:

| The user wants | Flags |
| --- | --- |
| Move the entry to another source, such as the `github` shorthand to an https `url` | `--source <spec>` |
| Bump or change a pin | `--ref <branch-or-tag>`, `--sha <commit>` |
| Change one field | `--description`, `--version`, `--homepage`, `--repository`, `--license`, `--keywords`, `--category` |
| Remove a field or a pin | `--unset <field>`, repeatable; `--unset ref`, `--unset sha` |

`--source` is read exactly the way `add` reads its spec, so the same collisions apply: write
`./plugins/alpha` or pass `--path` for a directory, and `--npm`, `--github`, `--url`, and `--subdir`
shape it the same way. A `<plugin>@<marketplace>` spec is refused; copying an entry is `add`'s job.

Two pin rules to state to the user before running:

- **A new git source keeps the old pin** unless `--ref` or `--sha` comes with it. Switching how a
  repository is reached does not move which commit installs.
- **`--ref` alone keeps an existing `sha`.** A sha pinned for the old ref then names a commit the
  new one has moved past. When bumping a ref, pass `--unset sha` too, or pass the new `--sha`.

## 2. Preview, then write

```bash
node scripts/update.mjs repobuddy --source https://github.com/cyberuni/repobuddy.git --dry-run
```

Resolve that path against this skill's own directory; `npx universal-plugin marketplace update` is
the fallback. Run `--dry-run` first and show the plan. The command never prompts.

| Status | Means |
| --- | --- |
| `updated` | the entry changed |
| `unchanged` | already says exactly this |
| `planned` | `--dry-run` only |
| `skipped` | that catalog is missing, does not list the entry, or its runtime cannot install the new source; the reason says which |

With no target flags all four catalogs are selected, so a `skipped` row for a catalog that never
listed the entry is normal. Report every skip with its reason anyway. Two deserve a sentence each:

- **A runtime that cannot install the new source keeps its old entry.** Moving an entry to `npm`
  leaves Copilot CLI and Cursor on the source they had. Say so; the user may want those entries
  removed, which is a hand decision this skill does not make.
- **A shield catalog may appear.** Copilot CLI and Cursor read the Claude catalog when they have none
  of their own. If the new source would break them there, their own catalog is written without the
  entry, as `add` does. Tell the user the file appeared and why.

The Codex catalog takes only `version` and `category` of the field flags, because that is all its
entries carry. A description changed everywhere else is not missing from Codex by mistake.

## 3. Validate

The command checks every catalog it plans to write, with the same checks as `validate`, before it
writes anything. An update that would introduce an issue stops and writes nothing; fix the input and
rerun. An issue the catalogs already had does not stop it.

So the write is safe, but the repository may still carry older issues. Follow
`references/validate.md` and report its result, not just the update's.

Then state plainly that nothing was published: the change sits in the repository until it is pushed
and a user refreshes the marketplace.

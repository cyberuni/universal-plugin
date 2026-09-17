# Route: validate

Check the catalogs the repository carries against the schema each runtime loads.

Every route ends here. A catalog the runtime rejects is worse than no catalog: it is found, read,
and refused at install time, far from the repository that wrote it. Never conclude the skill without
running this.

```bash
node scripts/validate.mjs
```

Resolve that path against this skill's own directory; `npx universal-plugin marketplace validate` is
the fallback. Exit status is 1 when any selected catalog is invalid, and every issue names the key
and the value to write instead, on stderr:

```
error: catalog ".claude-plugin/marketplace.json" does not match the marketplace schema:
  owner must be an object with a name, not string — write { "name": "Ari Vance" }
  plugins[0].repository must be a string, not object — write "https://github.com/o/r.git"
```

| Status | Means |
| --- | --- |
| `valid` | loads in that runtime |
| `invalid` | the runtime would refuse it; the issues say why |
| `missing` | no catalog at that path, which is only a failure under `--required` |

## Fixing what it reports

Fix an issue in the source it comes from, then regenerate. An entry's fields are derived, so an
npm-style `repository` object belongs fixed in the plugin's `plugin.json` (for a discovered plugin)
or passed as `--repository <url>` (for an added one).

The top-level `name` and `owner` live in the catalog itself, and `owner` must be an object —
`{ "name": "…" }`, never the `"Name <email>"` string `package.json` uses.

Nothing is repaired automatically. A catalog edited by hand is the user's to correct.

## The two checks the schema cannot make

- `--required`, for a target the user asked for and did not get.
- Sources on disk. Every `./` source is checked for existence. They resolve against the directory
  holding `.claude-plugin/`, and they do not resolve at all for a user who adds the marketplace by
  direct URL to the JSON file — which is the argument for a non-local source on a plugin
  distributed that way (`references/add.md`).

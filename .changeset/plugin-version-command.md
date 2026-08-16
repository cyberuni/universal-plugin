---
'universal-plugin': minor
---

New `universal-plugin plugin version <major|minor|patch|premajor|preminor|prepatch|prerelease|x.y.z>`
moves a plugin's version. A version lives in up to five places, but only two of them are
**authored**: the canonical root `plugin.json` and, when `.agents/universal-plugin.json` declares a
`packagePath`, that `package.json`. The rest — the per-vendor manifests, the local marketplace
catalogs, and the `npx`/`upx` pins in `skills/**` — are **derived** by commands that already exist.
So the verb writes the authored pair and then calls `plugin build`'s own writer to re-derive, rather
than becoming a second writer for files `build` owns.

`--preid <id>` picks the prerelease identifier, `--force` allows a version that does not advance,
`--no-build` skips re-derivation, and `--dry-run` reports the plan without writing. Every guard —
missing manifest, a relative bump with no current version, an unknown bump argument, a
non-advancing target, a declared `packagePath` whose `package.json` is absent — fails loud and
leaves the tree untouched.

`publish sync-version` keeps the opposite direction (a changesets-decided number flowing
`package.json` → manifest) with its behavior unchanged, but now shares the new applier so the two
directions cannot drift apart.

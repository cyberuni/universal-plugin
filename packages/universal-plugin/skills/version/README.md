# version skill

Move the version a plugin releases under, keeping every file that carries one in sync.

## The two authored numbers

A plugin's version appears in up to five places; only two are authored — the canonical `plugin.json`
and, when `packagePath` is declared, that `package.json`. The vendor manifests, the local marketplace
catalogs, and the `npx`/`upx` pins inside `skills/**/SKILL.md` are all derived.

That is why nothing here is hand-edited: editing one authored file leaves the other stale, and every
derived artifact with it. A consumer's plugin cache is keyed by version, so a content change without
a matching bump is invisible to them.

## Two release models

The first question the skill asks is whether the repository uses changesets.

- **With changesets** — the number is decided by the release, not by this skill. Add a changeset, let
  the release run, and `publish sync-version` carries the released number into the canonical
  manifest.
- **Without** — `plugin version <bump>` is the whole step. `scripts/version.mjs` runs it from the CLI
  shipped beside the skill, so nothing is downloaded.

Running `plugin version` in a changesets repository would decide a number changesets is about to
decide again. The skill checks for `.changeset/` before anything else.

## The part that is not automatable

Which release type to use is a promise to consumers about what broke. The skill offers the semver
reading — breaking → major, new behavior → minor, fix only → patch, adjusted for `0.x` — and asks
rather than guessing.

## References

- [`plugin version` spec](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/plugin/version/README.md)

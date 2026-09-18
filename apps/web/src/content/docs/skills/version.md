---
title: version
description: Move the number a plugin releases under.
---

Fronts `plugin version` and `publish sync-version`. It moves the number a plugin releases under. Its
first question is whether the repository uses changesets, because that decides who owns the number.

With changesets, the release decides it and `publish sync-version` carries it into the canonical
manifest. Without changesets, `plugin version <bump>` does the whole move. Running `plugin version`
in a changesets repository would pick a number changesets is about to pick again.

Which release type to use is not the skill's call. A version is a promise about what broke, so the
skill offers the semver reading and asks.

## See also

- [`upgrade-plugin`](../upgrade-plugin/) — moves the version your project *calls*, a different number
- [ADR-0010](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/design/decisions/0010-version-policy.md)

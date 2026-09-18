---
title: upgrade-plugin
description: Bump the pinned npx universal-plugin@<version> calls a project makes.
---

Bumps the pinned `universal-plugin` version in hook commands, `SKILL.md` files, docs, and any other
project files, from whatever is currently pinned to a target version — latest, or a specific semver.

It recognizes both runner words — `npx universal-plugin@<version>` and `upx universal-plugin@<version>`
(see [`adopt-upx`](../adopt-upx/)) — and keeps whichever one a reference already uses. This skill
only bumps the version; it never converts `npx` to `upx` or back.

`upgrade-plugin` moves the version your project *calls*. [`version`](../version/) moves the version
your plugin *publishes*. They are different numbers.

## What it does

Searches the project for every pinned occurrence, reports the files and versions found, and asks for
confirmation before rewriting. A cross-major bump needs an explicit confirmation of its own, since it
may carry breaking changes. Replacements are applied with the Edit tool rather than `sed`, so each
change is reviewable, and the search re-runs afterward to confirm no old pin remains.

## See also

- [`adopt-upx`](../adopt-upx/) — the runner word this skill leaves untouched
- [`version`](../version/) — moves the number the plugin publishes, not the one a project calls

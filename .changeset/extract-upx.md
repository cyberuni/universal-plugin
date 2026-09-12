---
"universal-plugin": minor
---

Move the `upx` runner into its own package, `@repobuddy/upx`.

A generic package runner is broader than this package's build/derivation charter — a placement note
in the spec has said so since it landed. It also made the wrong trade for `upx` itself: the runner's
value is *install once globally, use everywhere*, and that install should be small, so requiring
`npm i -g universal-plugin` to get a runner word worked against it.

Nothing about `upx`'s behavior changed, and the emitter side stays here: `plugin bundle --runner upx`,
the `adopt-upx` skill, and `upgrade-plugin`'s runner-word handling all still live in this package.
Their coupling was always to the *word* `upx`, never to its code.

**Install `@repobuddy/upx` directly** — `npm i -g @repobuddy/upx`. The `upx` bin on this package now
re-exports it so existing global installs keep working, and prints a deprecation notice on `--help`
(never on a normal call — `upx` is a transparent exec wrapper). It will be removed in the next major.

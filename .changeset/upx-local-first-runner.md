---
"universal-plugin": minor
---

Add `upx`, a local-first package runner, as a second lean bin.

`upx <pkg>@<range> [args…]` resolves the requested semver range against installed packages —
walking `node_modules` from the cwd up through its ancestors (nearest wins), then the global
`npm root -g` store — and spawns the matching binary directly, roughly 10× faster than `npx`
(which pays ~1s of registry resolution per call even when cached). On a miss it falls back to
`npx` with the spec exactly as given, printing a one-line stderr notice. It is a transparent
exec wrapper: the child owns stdout/stderr and its exit code; `upx` installs nothing and writes
nothing to `node_modules` or the global store. A dist-tag (`pkg@next`) goes straight to `npx`.

Also adds `plugin bundle --runner <npx|upx>`: omitting it preserves each skill reference's
existing runner word while re-pinning the version; `--runner upx` opts a release into emitting
`upx` references.

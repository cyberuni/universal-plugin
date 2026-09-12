#!/usr/bin/env node
// DEPRECATED. `upx` now ships as its own package, `@repobuddy/upx` — a generic package runner is
// broader than this package's build/derivation charter, and its whole value proposition is a small
// global install. This bin re-exports it so existing `npm i -g universal-plugin` setups keep
// working; it will be removed in the next major.
//
// The notice is printed only for `--help`, never on a normal invocation: `upx` is a transparent
// exec wrapper, and a line on every call would pollute the agent transcripts it exists to serve.
const argv = process.argv.slice(2)
if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
	process.stderr.write('upx: shipping `upx` from universal-plugin is deprecated — install `@repobuddy/upx` instead (npm i -g @repobuddy/upx).\n')
}
await import('@repobuddy/upx/cli')

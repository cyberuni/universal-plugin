import { defineConfig } from 'tsdown'

// A single config, because this package has no JS library surface at all: `exports`
// names only `./package.json`, and both bins are thin shims over `dist/cli.mjs`. So
// there is no consumer that needs a shared copy of a dependency, and everything can be
// inlined unconditionally.
export default defineConfig({
	entry: { cli: 'src/cli.ts' },
	outDir: 'dist',
	format: 'esm',
	platform: 'node',
	clean: true,
	// The vendor-registry ships JSON data the bundle cannot inline, so it is copied
	// alongside the output and must keep being published.
	copy: 'src/vendor-registry/data',
	// Every runtime dependency is inlined so the published `dist/cli.mjs` runs with no
	// `node_modules` present — the state an installed agent plugin is actually in,
	// since the plugin directory is a copy of the source checkout rather than an npm
	// install. This already holds for the published build and is what lets the shipped
	// skill launchers work from a plugin cache whose `node_modules` is absent or
	// incomplete; declaring it here makes it explicit rather than incidental.
	//
	// `@repobuddy/upx` is deliberately absent: it is not reachable from `src/cli.ts`.
	// The in-flight upx extraction added it so the separate `bin/upx.mjs` shim can
	// re-export it, and that shim is not a tsdown entry — so it stays a real runtime
	// dependency and the `upx` bin still needs an installed tree. Only the
	// `universal-plugin` bin comes out dependency-free.
	//
	// `onlyBundle: false` silences the "bundled a dependency" warnings that are the
	// whole point here.
	deps: {
		alwaysBundle: [/^@toon-format\/toon(\/|$)/, /^commander(\/|$)/, /^semver(\/|$)/],
		onlyBundle: false,
	},
})

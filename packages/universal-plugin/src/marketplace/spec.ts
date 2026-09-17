/** What a user names on the command line when they ask for a plugin to be listed, reduced to the
 *  source a catalog entry states. Pure: every rule here is a decision about the string itself, so
 *  nothing consults the filesystem, the network, or the runtime's configuration. */

import type { CatalogSource } from './marketplace.js'

/** The forms `marketplace add` accepts. `marketplace` is the odd one out: the catalog schema has no
 *  source type for "a plugin in some other marketplace", so it names an entry to go and read rather
 *  than a source to write. */
export type SourceKind = 'path' | 'npm' | 'github' | 'url' | 'marketplace'

export interface PluginSpec {
	kind: SourceKind
	/** The entry name the spec implies, before `--name` overrides it. */
	name: string
	/** The source to write, absent for `marketplace`, which has to be resolved first. */
	source?: string | CatalogSource
	/** `marketplace` only: the plugin to look for and the marketplace to look in. */
	plugin?: string
	marketplace?: string
}

const GITHUB_REPO = /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/
const NPM_PACKAGE = /^(?:@[A-Za-z0-9][A-Za-z0-9._-]*\/)?[A-Za-z0-9][A-Za-z0-9._-]*$/

/** The last meaningful segment of a path or URL, with a `.git` suffix removed. */
function basename(value: string): string {
	const segments = value.replace(/[/\\]+$/, '').split(/[/\\]/)
	return (segments[segments.length - 1] ?? value).replace(/\.git$/, '')
}

/** An npm package's entry name is the package name without its scope: `@cyberuni/upx` lists as
 *  `upx`, which is what a user installs and what every other source form yields. */
function packageEntryName(pkg: string): string {
	return pkg.startsWith('@') ? (pkg.split('/')[1] ?? pkg) : pkg
}

function pathSpec(value: string): PluginSpec {
	const normalized = value.replace(/\\/g, '/').replace(/\/+$/, '')
	const source = normalized.startsWith('./') || normalized.startsWith('../') ? normalized : `./${normalized}`
	return { kind: 'path', name: basename(normalized), source }
}

function npmSpec(pkg: string): PluginSpec {
	return { kind: 'npm', name: packageEntryName(pkg), source: { source: 'npm', package: pkg } }
}

function githubSpec(repo: string): PluginSpec {
	return { kind: 'github', name: basename(repo), source: { source: 'github', repo } }
}

function urlSpec(url: string): PluginSpec {
	return { kind: 'url', name: basename(url), source: { source: 'url', url } }
}

/** Splits `<plugin>@<marketplace>` at the separator that is not a scope marker, so a scoped package
 *  name keeps its leading `@`. */
function splitMarketplace(value: string): { plugin: string; marketplace: string } | undefined {
	const at = value.indexOf('@', value.startsWith('@') ? 1 : 0)
	if (at <= 0) return undefined
	const plugin = value.slice(0, at)
	const marketplace = value.slice(at + 1)
	if (plugin === '' || marketplace === '' || marketplace.includes('/')) return undefined
	return { plugin, marketplace }
}

function marketplaceSpec(value: string): PluginSpec {
	const split = splitMarketplace(value)
	if (!split) throw new Error(`error: "${value}" is not <plugin>@<marketplace>`)
	return { kind: 'marketplace', name: packageEntryName(split.plugin), ...split }
}

function looksLikeUrl(value: string): boolean {
	return value.includes('://') || value.startsWith('git@')
}

function looksLikePath(value: string): boolean {
	return value.startsWith('./') || value.startsWith('../') || value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value)
}

/** Applies the kind the user named, so every guess below has an override. */
function explicitSpec(value: string, kind: SourceKind): PluginSpec {
	switch (kind) {
		case 'path':
			return pathSpec(value)
		case 'npm':
			return npmSpec(value.replace(/^npm:/, ''))
		case 'github':
			return githubSpec(value)
		case 'url':
			return urlSpec(value)
		case 'marketplace':
			return marketplaceSpec(value)
	}
}

/** Reads a spec string as the source it names.
 *
 *  The order below is the disambiguation, and every step of it is overridable with an explicit kind:
 *
 *  1. an `npm:` prefix, which is how a bare name that looks like anything else is forced to a package
 *  2. a URL scheme or an `scp`-style `git@host:path`
 *  3. a path, which has to say so with `./`, `../`, or a leading slash
 *  4. `<plugin>@<marketplace>`, splitting after a leading scope `@` so `@scope/pkg` is not one
 *  5. `owner/repo`
 *  6. anything else left, which is an npm package name
 *
 *  Step 3 is why `plugins/alpha` reads as a GitHub repository rather than a directory: both are
 *  `a/b`, and a guess that reached for the filesystem would answer differently depending on where
 *  the command was run. `./plugins/alpha` or `--path` says it plainly. */
export function parsePluginSpec(value: string, kind?: SourceKind): PluginSpec {
	const spec = value.trim()
	if (spec === '') throw new Error('error: a plugin spec is required')
	if (kind) return explicitSpec(spec, kind)

	if (spec.startsWith('npm:')) {
		const pkg = spec.slice(4)
		if (!NPM_PACKAGE.test(pkg)) throw new Error(`error: "${pkg}" is not an npm package name`)
		return npmSpec(pkg)
	}
	if (looksLikeUrl(spec)) return urlSpec(spec)
	if (looksLikePath(spec)) return pathSpec(spec)

	const split = splitMarketplace(spec)
	if (split) return { kind: 'marketplace', name: packageEntryName(split.plugin), ...split }

	if (GITHUB_REPO.test(spec)) return githubSpec(spec)
	if (NPM_PACKAGE.test(spec)) return npmSpec(spec)
	throw new Error(`error: cannot tell what "${spec}" names; pass --path, --npm, --github, --url, or --from-marketplace`)
}

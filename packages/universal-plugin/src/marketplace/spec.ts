/** What a user names on the command line when they ask for a plugin to be listed, reduced to the
 *  source a catalog entry states. Pure: every rule here is a decision about the string itself, so
 *  nothing consults the filesystem, the network, or the runtime's configuration. */

import { type CatalogSource, originFromRepo } from './marketplace.js'

/** The forms `marketplace add` accepts. `marketplace` is the odd one out: the catalog schema has no
 *  source type for "a plugin in some other marketplace", so it names an entry to go and read rather
 *  than a source to write. */
export type SourceKind = 'path' | 'npm' | 'github' | 'url' | 'marketplace'

/** Everything that shapes a spec beyond the string itself. */
export interface SpecOptions {
	/** Overrides the guess about what the spec names. */
	kind?: SourceKind
	/** The plugin's directory inside the repository the spec names, for a monorepo. */
	subdir?: string
	/** A branch or tag to pin the source to. */
	ref?: string
	/** A commit to pin the source to. */
	sha?: string
}

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

const SHA = /^[a-f0-9]{40}$/

/** A subdirectory as `git-subdir` states it: no leading `./`, no trailing slash. */
function normalizeSubdir(subdir: string): string {
	const path = subdir
		.trim()
		.replace(/\\/g, '/')
		.replace(/^\.\/?/, '')
		.replace(/\/+$/, '')
	if (path === '') throw new Error('error: --subdir must name a directory inside the repository')
	if (path.startsWith('/')) throw new Error(`error: --subdir "${subdir}" must be relative to the repository root`)
	return path
}

/** The git URL a spec's source points at, for the two kinds that name a whole repository. */
function repositoryUrl(spec: PluginSpec): string | undefined {
	if (typeof spec.source !== 'object') return undefined
	if (spec.source.source === 'github') return originFromRepo(spec.source.repo as string).url
	if (spec.source.source === 'url') return spec.source.url as string
	return undefined
}

/** Narrows a whole-repository source to the one directory inside it that is the plugin.
 *
 *  A monorepo publishes several plugins from one repository, and neither `github` nor `url` can say
 *  which directory. `git-subdir` is the form that can, so `--subdir` turns the source into one —
 *  and the entry takes its name from that directory rather than from the repository. */
function withSubdir(spec: PluginSpec, subdir: string): PluginSpec {
	const url = repositoryUrl(spec)
	if (url === undefined) {
		throw new Error(`error: --subdir applies to a repository source, not to a ${spec.kind} one`)
	}
	const path = normalizeSubdir(subdir)
	return { kind: spec.kind, name: basename(path), source: { source: 'git-subdir', url, path } }
}

/** Pins a source to a branch, tag, or commit. Only the git-backed forms carry one; an npm package is
 *  pinned by version and a path is whatever is on disk. */
function withPin(spec: PluginSpec, ref?: string, sha?: string): PluginSpec {
	if (ref === undefined && sha === undefined) return spec
	const source = spec.source
	if (typeof source !== 'object' || !['url', 'github', 'git-subdir'].includes(source.source)) {
		throw new Error(`error: --ref and --sha apply to a git source, not to a ${spec.kind} one`)
	}
	if (sha !== undefined && !SHA.test(sha)) {
		throw new Error(`error: --sha "${sha}" must be a full 40-character commit hash`)
	}
	return {
		...spec,
		source: { ...source, ...(ref === undefined ? {} : { ref }), ...(sha === undefined ? {} : { sha }) },
	}
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
export function parsePluginSpec(value: string, opts: SpecOptions = {}): PluginSpec {
	const { kind, subdir, ref, sha } = opts
	const spec = value.trim()
	if (spec === '') throw new Error('error: a plugin spec is required')
	const shape = (base: PluginSpec): PluginSpec =>
		withPin(subdir === undefined ? base : withSubdir(base, subdir), ref, sha)
	if (kind) return shape(explicitSpec(spec, kind))

	if (spec.startsWith('npm:')) {
		const pkg = spec.slice(4)
		if (!NPM_PACKAGE.test(pkg)) throw new Error(`error: "${pkg}" is not an npm package name`)
		return shape(npmSpec(pkg))
	}
	if (looksLikeUrl(spec)) return shape(urlSpec(spec))
	if (looksLikePath(spec)) return shape(pathSpec(spec))

	const split = splitMarketplace(spec)
	if (split) return shape({ kind: 'marketplace', name: packageEntryName(split.plugin), ...split })

	if (GITHUB_REPO.test(spec)) return shape(githubSpec(spec))
	if (NPM_PACKAGE.test(spec)) return shape(npmSpec(spec))
	throw new Error(`error: cannot tell what "${spec}" names; pass --path, --npm, --github, --url, or --from-marketplace`)
}

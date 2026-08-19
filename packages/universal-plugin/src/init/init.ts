/** Pure domain for `plugin init` — scaffolding the canonical manifest, registering the plugin in the
 *  repository's local marketplace catalogs, and (with `--npm`) wiring an npm package to ship it.
 *
 *  No I/O: the caller gathers the current filesystem state, calls `planInit`, and applies the
 *  returned plan. `planInit` owns the rules — the guard order, the closed manifest shape, the
 *  no-`--vendor` default (omit the `vendors` key, never write `vendors: []` — `plugin build`'s
 *  `vendors ?? harnesses`-keys fallback engages only on an absent key), and the `--npm`
 *  files-wiring default (`claude-code`). The vendor→derived-manifest-path map is injected so the
 *  domain stays free of the build/registry layer. */

import {
	type MarketplaceMetadata,
	type MarketplaceOwner,
	mergeCatalogEntry,
	VENDOR_TARGETS,
} from '../marketplace/marketplace.js'
import { formatCatalogIssues, validateCatalogContent } from '../marketplace/validation.js'

const SCHEMA_URL = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json'
const UP_NAMESPACE = 'org.cyberuni.universal-plugin'
const SCAFFOLD_DIRS = ['skills', 'agents', 'governances', 'commands'] as const

export interface InitOptions {
	name?: string
	/** The resolved `--vendor` list; empty when none was passed. */
	vendors: string[]
	scaffold: boolean
	force: boolean
	npm: boolean
	/** `--no-marketplace` opts out of the local catalogs; the default is to write them. */
	marketplace?: boolean
}

/** Where the plugin sits in its repository, and what catalogs that repository already carries.
 *  Absent when the plugin root is not inside a repository, which is the one case with nowhere to
 *  put a catalog. */
export interface RepoState {
	/** POSIX path from the repository root to the plugin root; empty when they are the same. */
	pluginPath: string
	/** The repository root's directory name. */
	dirName: string
	/** `owner/repo` from the git remote, when there is one. */
	slug?: { owner: string; repo: string }
	/** Existing catalog text, keyed by repository-root-relative path. */
	catalogs: Record<string, string>
}

export interface InitState {
	manifestExists: boolean
	/** The parsed root `package.json`, or `null` when absent. */
	packageJson: Record<string, unknown> | null
	repo?: RepoState
}

export interface FileRow {
	path: string
	action: 'created' | 'updated' | 'unchanged'
}

/** A catalog to write, at a path relative to the plugin root — so a plugin below the repository
 *  root reaches its catalogs through `../`. */
export interface CatalogArtifact {
	path: string
	content: string
}

export interface InitPlan {
	manifest: Record<string, unknown>
	/** Scaffold directories to create (relative to root); empty without `--scaffold`. */
	dirs: string[]
	/** The rewritten `package.json` to write, or `null` when `--npm` was not passed. */
	packageJson: Record<string, unknown> | null
	catalogs: CatalogArtifact[]
	rows: FileRow[]
	/** What was skipped and why — the caller reports these; none of them is a failure. */
	notes: string[]
	summary: { created: number; updated: number; unchanged: number }
}

/** The closed canonical manifest init writes: `$schema` + `name`, plus the extensions namespace
 *  carrying the `vendors` list only when `--vendor` was passed. */
export function buildManifest(name: string, vendors: string[]): Record<string, unknown> {
	const manifest: Record<string, unknown> = { $schema: SCHEMA_URL, name }
	if (vendors.length > 0) {
		manifest.extensions = { [UP_NAMESPACE]: { vendors } }
	}
	return manifest
}

/** The open-standard base every published plugin ships, whatever it targets: the canonical
 *  Agent Plugins Spec manifest and the skills directory every runtime reads. Vendor-derived
 *  manifests layer on top of this — they never replace it. */
const STANDARD_FILES = ['plugin.json', 'skills/'] as const

/** Adds the open-standard base plus each derived manifest path to `package.json` `files`, creating
 *  the array when absent and never duplicating an entry. Other fields and existing entries are
 *  preserved. The base goes in regardless of `--vendor`: a package that ships only
 *  `.claude-plugin/plugin.json` has published a Claude Code plugin, not a standard one. */
export function wireFiles(pkg: Record<string, unknown>, manifestPaths: string[]): Record<string, unknown> {
	const files = Array.isArray(pkg.files) ? [...(pkg.files as unknown[])] : []
	for (const entry of [...STANDARD_FILES, ...manifestPaths]) {
		if (!files.includes(entry)) files.push(entry)
	}
	return { ...pkg, files }
}

/** The local marketplace a repository carries is named after the repository, not after the plugin:
 *  the catalog sits at the repository root and lists every plugin the repository develops. `-local`
 *  separates it from a published marketplace of the same plugins. */
function marketplaceName(repo: RepoState): string {
	const base = repo.slug ? `${repo.slug.owner}-${repo.slug.repo}` : repo.dirName
	return `${base}-local`
}

/** An npm `author` — `"Bea <bea@example.com> (https://example.com)"` or the object form — read as a
 *  catalog owner. */
function readAuthor(author: unknown): MarketplaceOwner | undefined {
	if (typeof author === 'string') {
		const name = author.replace(/[<(].*$/, '').trim()
		return name === '' ? undefined : { name }
	}
	if (typeof author !== 'object' || author === null) return undefined
	const record = author as Record<string, unknown>
	if (typeof record.name !== 'string' || record.name.trim() === '') return undefined
	const owner: MarketplaceOwner = { name: record.name }
	if (typeof record.email === 'string') owner.email = record.email
	if (typeof record.url === 'string') owner.url = record.url
	return owner
}

/** Who the catalog says maintains the marketplace. The canonical manifest first, then the package
 *  that ships it, then the account the repository lives under. Every runtime requires this, so a
 *  repository with none of the three gets no catalog rather than an invented owner. */
function catalogOwner(
	state: InitState,
	repo: RepoState,
	manifest: Record<string, unknown>,
): MarketplaceOwner | undefined {
	return (
		readAuthor(manifest.author) ??
		readAuthor(state.packageJson?.author) ??
		(repo.slug ? { name: repo.slug.owner } : undefined)
	)
}

/** The plugin's own entry in every selected vendor's catalog, folded into whatever the repository
 *  already carries. Nothing here authors a version: the entry carries the canonical manifest's, and
 *  the manifest `init` writes carries none (ADR-0010). */
function planCatalogs(
	state: InitState,
	opts: InitOptions,
	manifest: Record<string, unknown>,
	notes: string[],
): CatalogArtifact[] {
	if (opts.marketplace === false || opts.vendors.length === 0) return []
	const repo = state.repo
	if (!repo) {
		notes.push('no local marketplace catalog: the plugin root is not inside a repository')
		return []
	}
	const owner = catalogOwner(state, repo, manifest)
	if (!owner) {
		notes.push('no local marketplace catalog: no owner to name — add an author to plugin.json')
		return []
	}

	const metadata: MarketplaceMetadata = { name: marketplaceName(repo), owner }
	const source = repo.pluginPath === '' ? './' : `./${repo.pluginPath}`
	const plugin = { name: manifest.name as string, source, metadata: manifest }
	const toPluginRoot =
		repo.pluginPath === ''
			? ''
			: `${repo.pluginPath
					.split('/')
					.map(() => '..')
					.join('/')}/`

	const catalogs: CatalogArtifact[] = []
	for (const vendor of opts.vendors) {
		const target = VENDOR_TARGETS[vendor]
		if (!target) continue
		const artifact = mergeCatalogEntry(target, metadata, plugin, (path) => repo.catalogs[path])
		// A catalog this repository already carried may say something its runtime rejects — `owner` as a
		// string is the usual one. Init folds its entry in and names the problem; it does not rewrite
		// someone else's top-level metadata.
		const issues = validateCatalogContent(target, artifact.content)
		if (issues.length > 0) notes.push(formatCatalogIssues(artifact.path, issues))
		catalogs.push({ path: `${toPluginRoot}${artifact.path}`, content: artifact.content })
	}
	return catalogs
}

/** Plans the init run. Throws on a guard failure (an existing manifest without `--force`; `--npm`
 *  with no `package.json`) before returning any plan, so the caller writes nothing on a guard trip. */
export function planInit(
	state: InitState,
	opts: InitOptions,
	rootDirName: string,
	resolveManifestPath: (vendor: string) => string | undefined,
): InitPlan {
	// --npm requires a package.json; the guard fires before the manifest write.
	if (opts.npm && state.packageJson === null) {
		throw new Error('error: --npm requires a package.json at the project root')
	}
	if (state.manifestExists && !opts.force) {
		throw new Error('plugin.json already exists — pass --force to overwrite')
	}

	const name = opts.name ?? rootDirName
	const manifest = buildManifest(name, opts.vendors)
	const dirs = opts.scaffold ? [...SCAFFOLD_DIRS] : []
	const rows: FileRow[] = [{ path: 'plugin.json', action: 'created' }]
	const notes: string[] = []
	const catalogs = planCatalogs(state, opts, manifest, notes)
	const existing = state.repo?.catalogs ?? {}
	for (const catalog of catalogs) {
		const previous = existing[catalog.path.replace(/^(\.\.\/)+/, '')]
		rows.push({
			path: catalog.path,
			action: previous === undefined ? 'created' : previous === catalog.content ? 'unchanged' : 'updated',
		})
	}

	let packageJson: Record<string, unknown> | null = null
	if (opts.npm) {
		// The files-wiring default is claude-code, independent of the manifest's (omitted) vendors list.
		const wireVendors = opts.vendors.length > 0 ? opts.vendors : ['claude-code']
		const manifestPaths = wireVendors.map(resolveManifestPath).filter((p): p is string => Boolean(p))
		packageJson = wireFiles(state.packageJson as Record<string, unknown>, manifestPaths)
		rows.push({ path: 'package.json', action: 'updated' })
	}

	const created = rows.filter((r) => r.action === 'created').length
	const updated = rows.filter((r) => r.action === 'updated').length
	const unchanged = rows.filter((r) => r.action === 'unchanged').length
	return { manifest, dirs, packageJson, catalogs, rows, notes, summary: { created, updated, unchanged } }
}

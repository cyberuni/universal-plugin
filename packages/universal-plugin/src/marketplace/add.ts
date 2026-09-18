import * as path from 'node:path'

import {
	gitRemoteUrl,
	type MarketplaceFs,
	readMarketplaceCatalog,
	realMarketplaceFs,
	resolveKnownMarketplace,
} from './fs.js'
import { deriveMetadata } from './init.js'
import {
	absoluteSource,
	assertMarketplaceName,
	type CatalogSource,
	isLocalCatalogSource,
	type MarketplaceMetadata,
	type MarketplacePlugin,
	type MarketplaceTarget,
	mergeCatalogEntry,
	originFromUrl,
	sameCatalogContent,
	TARGET_CATALOG_PATHS,
	TARGET_SOURCE_KINDS,
} from './marketplace.js'
import { type PluginSpec, parsePluginSpec, type SourceKind } from './spec.js'
import { formatCatalogIssues, validateCatalogContent } from './validation.js'

/** The manifest fields a catalog entry carries. Exactly the set the catalog already derives from a
 *  discovered plugin, so an added entry and a discovered one say the same kinds of things. */
export const ENTRY_METADATA_FIELDS = [
	'description',
	'version',
	'homepage',
	'repository',
	'license',
	'keywords',
] as const

export type EntryMetadataField = (typeof ENTRY_METADATA_FIELDS)[number]

export interface MarketplaceAddOptions {
	targets?: MarketplaceTarget[]
	/** Overrides the guess `parsePluginSpec` would make about what the spec names. */
	kind?: SourceKind
	/** The plugin's directory inside the repository the spec names, for a monorepo. */
	subdir?: string
	/** A branch, tag, or commit to pin a git source to. */
	ref?: string
	sha?: string
	/** The entry name, when it should differ from the one the spec implies. */
	name?: string
	/** Where to read a `<plugin>@<marketplace>` entry from when that marketplace is not installed. */
	from?: string
	metadata?: Partial<Record<EntryMetadataField, unknown>>
	/** The catalog's own identity, used only when this command has to create one. */
	marketplaceName?: string
	owner?: string
	dryRun?: boolean
	force?: boolean
}

export type MarketplaceAddStatus = 'added' | 'updated' | 'unchanged' | 'planned' | 'skipped'

export interface MarketplaceAddResult {
	target: MarketplaceTarget
	status: MarketplaceAddStatus
	entry: string
	source: string
	path: string
	reason?: string
}

/** The kind name used to decide whether a runtime accepts a source, from the source itself. */
function sourceKindOf(source: string | CatalogSource): string {
	if (isLocalCatalogSource(source)) return 'path'
	return typeof source === 'string' ? 'path' : source.source
}

/** A source rendered for the result table — one short cell, not a JSON blob. */
function describeSource(source: string | CatalogSource): string {
	if (typeof source === 'string') return source
	const detail = source.package ?? source.repo ?? source.url ?? source.path
	return typeof detail === 'string' ? `${source.source}:${detail}` : String(source.source)
}

function readJsonFile(fs: MarketplaceFs, file: string): Record<string, unknown> | undefined {
	if (!fs.exists(file)) return undefined
	try {
		const parsed = JSON.parse(fs.read(file))
		return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: undefined
	} catch {
		return undefined
	}
}

/** Metadata already on this machine for the plugin being listed.
 *
 *  A local path carries its own manifest, and an npm package that happens to be installed carries a
 *  `package.json`. Neither is fetched: what is here is read, what is not here is left to the
 *  metadata flags. An entry missing an optional field still installs. */
function localMetadata(root: string, spec: PluginSpec, fs: MarketplaceFs): Record<string, unknown> {
	if (spec.kind === 'path' && typeof spec.source === 'string') {
		return readJsonFile(fs, path.join(root, spec.source, 'plugin.json')) ?? {}
	}
	if (spec.kind === 'npm' && typeof spec.source === 'object') {
		const pkg = spec.source.package
		if (typeof pkg !== 'string') return {}
		return readJsonFile(fs, path.join(root, 'node_modules', pkg, 'package.json')) ?? {}
	}
	return {}
}

/** The entry another marketplace already publishes for this plugin, copied rather than invented.
 *
 *  The catalog schema has no "from another marketplace" source, so there is nothing to write until
 *  that marketplace has been read. Its entry already names a source every runtime can resolve — that
 *  is what makes it publishable — so the whole entry comes across. */
function resolveFromMarketplace(
	spec: PluginSpec,
	opts: MarketplaceAddOptions,
	fs: MarketplaceFs,
): { source: string | CatalogSource; metadata: Record<string, unknown> } {
	const marketplace = spec.marketplace as string
	const known = opts.from === undefined ? resolveKnownMarketplace(marketplace, fs) : { dir: opts.from }
	if (known === undefined) {
		throw new Error(
			`error: marketplace "${marketplace}" is not installed; add it in the runtime first, or pass --from <path>`,
		)
	}
	const dir = known.dir
	const content = readMarketplaceCatalog(dir, fs)
	if (content === undefined) throw new Error(`error: no marketplace.json found under "${dir}"`)

	let catalog: unknown
	try {
		catalog = JSON.parse(content)
	} catch {
		throw new Error(`error: the catalog in "${dir}" is not valid JSON`)
	}
	const entries =
		typeof catalog === 'object' && catalog !== null && Array.isArray((catalog as Record<string, unknown>).plugins)
			? ((catalog as Record<string, unknown>).plugins as unknown[])
			: []
	const found = entries.find(
		(entry) => typeof entry === 'object' && entry !== null && (entry as Record<string, unknown>).name === spec.plugin,
	) as Record<string, unknown> | undefined
	if (!found) throw new Error(`error: marketplace "${marketplace}" lists no plugin "${spec.plugin}"`)

	const source = found.source
	if (source === undefined) throw new Error(`error: the "${spec.plugin}" entry in "${marketplace}" names no source`)
	if (!isLocalCatalogSource(source)) return { source: source as CatalogSource, metadata: found }

	// A relative source resolves against the other marketplace's root, which this repository is not,
	// so carrying it across unchanged would name a directory that does not exist here. It is still a
	// location inside a repository whose URL is known, which `git-subdir` states exactly.
	const remote = gitRemoteUrl(dir)
	const origin = known.origin ?? (remote === undefined ? undefined : originFromUrl(remote))
	if (origin === undefined) {
		throw new Error(
			`error: "${spec.plugin}" is local to marketplace "${marketplace}", and that marketplace has no remote to rewrite its source against`,
		)
	}
	const rewritten = absoluteSource(origin, source as string | CatalogSource)
	if (rewritten === undefined) {
		throw new Error(`error: the "${spec.plugin}" entry in "${marketplace}" names a source this command cannot read`)
	}
	return { source: rewritten, metadata: found }
}

function selectedTargets(targets?: MarketplaceTarget[]): MarketplaceTarget[] {
	return targets && targets.length > 0 ? [...new Set(targets)] : ['claude', 'codex', 'copilot', 'cursor']
}

function entryMetadata(
	discovered: Record<string, unknown>,
	supplied: Partial<Record<EntryMetadataField, unknown>> = {},
): Record<string, unknown> {
	const metadata: Record<string, unknown> = {}
	for (const field of ENTRY_METADATA_FIELDS) {
		const value = supplied[field] ?? discovered[field]
		if (value !== undefined) metadata[field] = value
	}
	return metadata
}

function catalogEntry(content: string, name: string): unknown {
	try {
		const parsed = JSON.parse(content) as Record<string, unknown>
		if (!Array.isArray(parsed.plugins)) return undefined
		return parsed.plugins.find(
			(entry) => typeof entry === 'object' && entry !== null && (entry as Record<string, unknown>).name === name,
		)
	} catch {
		return undefined
	}
}

/** Lists a plugin that lives somewhere else in this repository's catalogs.
 *
 *  Where `marketplace init` derives a catalog from the plugins a repository holds, this adds one it
 *  does not: an npm package, a GitHub repository, an entry another marketplace already publishes.
 *  Together they let one repository be both — a plugin's own home and a curated list.
 *
 *  Nothing is fetched and nothing is published. The command reads this repository, and at most a
 *  marketplace already installed on this machine, and writes catalog files. */
export function addToMarketplace(
	rootInput: string,
	spec: string,
	opts: MarketplaceAddOptions = {},
	fs: MarketplaceFs = realMarketplaceFs,
): MarketplaceAddResult[] {
	const root = path.resolve(rootInput)
	const parsed = parsePluginSpec(spec, { kind: opts.kind, subdir: opts.subdir, ref: opts.ref, sha: opts.sha })
	const name = opts.name ?? parsed.name
	assertMarketplaceName(name, 'plugin name')

	const resolved =
		parsed.kind === 'marketplace'
			? resolveFromMarketplace(parsed, opts, fs)
			: { source: parsed.source as string | CatalogSource, metadata: localMetadata(root, parsed, fs) }

	const metadata: MarketplaceMetadata = deriveMetadata(root, fs, { name: opts.marketplaceName, owner: opts.owner })
	const plugin: MarketplacePlugin = {
		name,
		source: resolved.source,
		metadata: entryMetadata(resolved.metadata, opts.metadata),
	}
	const kind = sourceKindOf(resolved.source)
	const rendered = describeSource(resolved.source)

	const planned = selectedTargets(opts.targets).map((target) => {
		const catalogPath = TARGET_CATALOG_PATHS[target]
		const file = path.join(root, catalogPath)
		const existing = fs.exists(file) ? fs.read(file) : undefined
		if (!TARGET_SOURCE_KINDS[target].includes(kind)) {
			return {
				target,
				catalogPath,
				file,
				existing,
				skipped: `${kind} source is not supported by ${target}`,
				artifact: undefined,
			}
		}
		// `add` was asked for this source, so it is the one caller that replaces an existing one.
		const artifact = mergeCatalogEntry(target, metadata, plugin, () => existing, { keepForeignSource: false })
		return { target, catalogPath, file, existing, skipped: undefined, artifact }
	})

	for (const entry of planned) {
		if (!entry.artifact) continue
		const issues = validateCatalogContent(entry.target, entry.artifact.content)
		if (issues.length > 0) throw new Error(formatCatalogIssues(entry.catalogPath, issues))
	}

	// Replacing an entry someone already wrote is the one destructive thing here, so it needs saying.
	const conflicts = planned
		.filter((entry) => {
			if (!entry.artifact || entry.existing === undefined || opts.force) return false
			const before = catalogEntry(entry.existing, name)
			if (before === undefined) return false
			return !sameCatalogContent(entry.existing, entry.artifact.content)
		})
		.map((entry) => entry.catalogPath)
	if (conflicts.length > 0) {
		throw new Error(
			`error: "${name}" is already listed differently in ${conflicts.join(', ')}; rerun with --force to replace it`,
		)
	}

	const results: MarketplaceAddResult[] = planned.map((entry) => {
		const row = { target: entry.target, entry: name, source: rendered, path: entry.catalogPath }
		if (entry.skipped || !entry.artifact) {
			return { ...row, status: 'skipped' as const, source: rendered, reason: entry.skipped }
		}
		if (entry.existing !== undefined && sameCatalogContent(entry.existing, entry.artifact.content)) {
			return { ...row, status: 'unchanged' as const }
		}
		if (opts.dryRun) return { ...row, status: 'planned' as const }
		const existed = entry.existing !== undefined && catalogEntry(entry.existing, name) !== undefined
		return { ...row, status: existed ? ('updated' as const) : ('added' as const) }
	})

	if (!opts.dryRun) {
		for (const entry of planned) {
			if (!entry.artifact) continue
			if (entry.existing !== undefined && sameCatalogContent(entry.existing, entry.artifact.content)) continue
			fs.writeAtomically(entry.file, entry.artifact.content)
		}
	}
	return results
}

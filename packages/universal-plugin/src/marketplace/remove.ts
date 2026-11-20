import * as path from 'node:path'

import { describeSource, selectedTargets } from './add.js'
import { type MarketplaceFs, realMarketplaceFs } from './fs.js'
import {
	assertMarketplaceName,
	type CatalogSource,
	findCatalogEntry,
	type MarketplaceTarget,
	removeCatalogEntry,
	TARGET_CATALOG_PATHS,
} from './marketplace.js'
import { introducedIssues } from './validate.js'
import { formatCatalogIssues } from './validation.js'

export interface MarketplaceRemoveOptions {
	targets?: MarketplaceTarget[]
	/** Remove the entry even when a plugin the catalogs still list depends on it. */
	force?: boolean
	dryRun?: boolean
}

export type MarketplaceRemoveStatus = 'removed' | 'planned' | 'skipped'

export interface MarketplaceRemoveResult {
	target: MarketplaceTarget
	status: MarketplaceRemoveStatus
	entry: string
	/** The source the removed entry stated, or `-` when this catalog did not list it. */
	source: string
	path: string
	reason?: string
}

export interface MarketplaceRemoveReport {
	results: MarketplaceRemoveResult[]
	/** What a forced removal left broken, and what the next `plugin build` or `marketplace init` will
	 *  undo. Each is a line for stderr. */
	warnings: string[]
}

interface PlannedTarget {
	target: MarketplaceTarget
	catalogPath: string
	file: string
	source?: unknown
	content?: string
	skipped?: string
}

/** The path a local entry names inside the repository, for Codex's tagged form as well as a bare
 *  `./` string. */
function localPath(source: unknown): string | undefined {
	if (typeof source === 'string') return source
	if (typeof source === 'object' && source !== null && (source as Record<string, unknown>).source === 'local') {
		const location = (source as Record<string, unknown>).path
		return typeof location === 'string' ? location : undefined
	}
	return undefined
}

/** Drops one entry from every selected catalog that lists it, the inverse of `marketplace add`.
 *
 *  Everything else in each catalog stays as it was: the top level, the other entries, and their
 *  order. A catalog that does not list the entry is skipped, and an entry no selected catalog lists
 *  is an error, so a typo in the name is not reported as success.
 *
 *  The result is validated before anything is written, the way `update` validates. A removal that
 *  would leave a listed plugin with a dependency its catalog no longer resolves stops, naming the
 *  dependent; `force` removes the entry anyway and reports what it broke. Nothing is fetched,
 *  uninstalled, or published. */
export function removeMarketplaceEntry(
	rootInput: string,
	name: string,
	opts: MarketplaceRemoveOptions = {},
	fs: MarketplaceFs = realMarketplaceFs,
): MarketplaceRemoveReport {
	const root = path.resolve(rootInput)
	assertMarketplaceName(name, 'plugin name')
	const targets = selectedTargets(opts.targets)

	const planned: PlannedTarget[] = targets.map((target) => {
		const catalogPath = TARGET_CATALOG_PATHS[target]
		const file = path.join(root, catalogPath)
		if (!fs.exists(file)) return { target, catalogPath, file, skipped: `no catalog at ${catalogPath}` }
		const existing = fs.read(file)
		const entry = findCatalogEntry(existing, catalogPath, name)
		if (entry === undefined) return { target, catalogPath, file, skipped: `"${name}" is not listed in ${catalogPath}` }
		return { target, catalogPath, file, source: entry.source, content: removeCatalogEntry(existing, catalogPath, name) }
	})

	const removing = planned.filter((entry) => entry.content !== undefined)
	if (removing.length === 0) {
		throw new Error(`error: "${name}" is not listed in any selected catalog; nothing to remove`)
	}

	const writes = new Map(removing.map((entry) => [entry.file, entry.content as string]))
	const introduced = introducedIssues(root, targets, writes, fs)
	const warnings: string[] = []
	if (introduced.length > 0) {
		const report = introduced.map((row) => formatCatalogIssues(row.path, row.issues)).join('\n')
		if (!opts.force) {
			throw new Error(
				`${report}\nerror: removing "${name}" would break the catalogs above; pass --force to remove it anyway`,
			)
		}
		warnings.push(`warning: removed "${name}" anyway (--force); the catalogs now have these issues:\n${report}`)
	}

	// An entry for a plugin that still sits in this repository comes back: `plugin build` refreshes
	// its own entry, and `marketplace init` lists what it discovers.
	const kept = new Set<string>()
	for (const entry of removing) {
		const location = localPath(entry.source)
		if (location === undefined || kept.has(location)) continue
		if (!fs.exists(path.join(root, location, 'plugin.json'))) continue
		kept.add(location)
		warnings.push(
			`warning: "${name}" still has a plugin.json at ${location}; plugin build and marketplace init will list it again until that plugin is removed`,
		)
	}

	const results = planned.map((entry): MarketplaceRemoveResult => {
		const row = {
			target: entry.target,
			entry: name,
			source: entry.source === undefined ? '-' : describeSource(entry.source as string | CatalogSource),
			path: entry.catalogPath,
		}
		if (entry.skipped !== undefined) return { ...row, status: 'skipped', reason: entry.skipped }
		return { ...row, status: opts.dryRun ? 'planned' : 'removed' }
	})

	if (!opts.dryRun) for (const [file, content] of writes) fs.writeAtomically(file, content)
	return { results, warnings }
}

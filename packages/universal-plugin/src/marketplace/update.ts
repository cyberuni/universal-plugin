import * as path from 'node:path'

import { describeSource, ENTRY_METADATA_FIELDS, selectedTargets } from './add.js'
import { type MarketplaceFs, realMarketplaceFs } from './fs.js'
import {
	adaptCatalogContent,
	adaptSource,
	assertMarketplaceName,
	type CatalogSource,
	catalogEntrySource,
	deriveSharedCatalog,
	findCatalogEntry,
	type MarketplaceTarget,
	replaceCatalogEntry,
	sameCatalogContent,
	sourceKindOf,
	TARGET_CATALOG_PATHS,
} from './marketplace.js'
import { assertCommitSha, isGitSource, parsePluginSpec, type SourceKind } from './spec.js'
import { validateMarketplace } from './validate.js'
import { type CatalogIssue, formatCatalogIssues } from './validation.js'

/** The fields `update` sets by flag: the ones `add` writes, plus `category`, which a curator sets by
 *  hand and `add --force` has no way to keep. */
export const UPDATE_FIELDS = [...ENTRY_METADATA_FIELDS, 'category'] as const

export type UpdateField = (typeof UPDATE_FIELDS)[number]

export interface MarketplaceUpdateOptions {
	targets?: MarketplaceTarget[]
	/** A new source, read the way `marketplace add` reads its spec. */
	source?: string
	/** Overrides the guess about what `source` names. */
	kind?: SourceKind
	/** The plugin's directory inside the repository `source` names, for a monorepo. */
	subdir?: string
	ref?: string
	sha?: string
	metadata?: Partial<Record<UpdateField, unknown>>
	/** Fields to remove from the entry. `ref` and `sha` remove a pin from its source. */
	unset?: string[]
	dryRun?: boolean
}

export type MarketplaceUpdateStatus = 'updated' | 'unchanged' | 'planned' | 'skipped'

export interface MarketplaceUpdateResult {
	target: MarketplaceTarget
	status: MarketplaceUpdateStatus
	entry: string
	source: string
	path: string
	reason?: string
}

interface EntryChange {
	source?: string | CatalogSource
	ref?: string
	sha?: string
	metadata: Record<string, unknown>
	unset: string[]
}

const PINS = ['ref', 'sha'] as const

/** The field flags a Codex entry carries. Its catalog states a plugin by name, source, version, and
 *  category, so a description or a license set there would be a field no generator writes. */
const CODEX_FIELDS: readonly string[] = ['version', 'category']

/** Reads the flags into one change, refusing a request that contradicts itself or changes nothing. */
function readChange(opts: MarketplaceUpdateOptions): EntryChange {
	const unset = [...new Set(opts.unset ?? [])]
	for (const field of unset) {
		if (field === 'name' || field === 'source') {
			throw new Error(`error: --unset cannot remove "${field}"; every entry needs one`)
		}
	}
	const metadata: Record<string, unknown> = {}
	for (const [field, value] of Object.entries(opts.metadata ?? {})) {
		if (value !== undefined) metadata[field] = value
	}
	const set = [
		...Object.keys(metadata),
		...(opts.ref === undefined ? [] : ['ref']),
		...(opts.sha === undefined ? [] : ['sha']),
	]
	const both = set.filter((field) => unset.includes(field))
	if (both.length > 0) throw new Error(`error: "${both[0]}" is both set and unset`)
	if (opts.sha !== undefined) assertCommitSha(opts.sha)

	let source: string | CatalogSource | undefined
	if (opts.source !== undefined) {
		const parsed = parsePluginSpec(opts.source, { kind: opts.kind, subdir: opts.subdir, ref: opts.ref, sha: opts.sha })
		if (parsed.kind === 'marketplace' || parsed.source === undefined) {
			throw new Error(
				'error: --source names where the plugin lives, not <plugin>@<marketplace>; copy an entry with marketplace add',
			)
		}
		source = parsed.source
	} else if (opts.kind !== undefined || opts.subdir !== undefined) {
		throw new Error('error: a source kind and --subdir shape --source; pass --source as well')
	}

	if (
		source === undefined &&
		opts.ref === undefined &&
		opts.sha === undefined &&
		set.length === 0 &&
		unset.length === 0
	) {
		throw new Error('error: nothing to change; pass --source, --ref, --sha, a field flag, or --unset')
	}
	return { source, ref: opts.ref, sha: opts.sha, metadata, unset }
}

function pinsOf(source: CatalogSource): Record<string, unknown> {
	const pins: Record<string, unknown> = {}
	for (const pin of PINS) if (typeof source[pin] === 'string') pins[pin] = source[pin]
	return pins
}

/** The entry as it reads after the change, for one target. Every field the change does not name is
 *  kept as it stands, and so is the key order. A new source this runtime cannot install leaves the
 *  entry as it is, and the reason says why. */
function changeEntry(
	target: MarketplaceTarget,
	catalogPath: string,
	entry: Record<string, unknown>,
	change: EntryChange,
): { entry: Record<string, unknown> } | { omitted: string } {
	const next: Record<string, unknown> = { ...entry }
	const pinned = change.ref !== undefined || change.sha !== undefined
	if (change.source !== undefined) {
		// A new source keeps the pin the old one carried, unless the change names a pin of its own:
		// switching how a repository is reached does not move which commit is installed.
		const carried =
			!pinned && isGitSource(change.source) && isGitSource(entry.source)
				? { ...change.source, ...pinsOf(entry.source) }
				: change.source
		const adapted = adaptSource(target, carried)
		if ('omitted' in adapted) return { omitted: adapted.omitted }
		next.source = catalogEntrySource(target, adapted.source)
	} else if (pinned) {
		if (!isGitSource(entry.source)) {
			const kind =
				typeof entry.source === 'string' || (typeof entry.source === 'object' && entry.source !== null)
					? sourceKindOf(entry.source as string | CatalogSource)
					: 'missing'
			throw new Error(
				`error: "${String(entry.name)}" in ${catalogPath} has a ${kind} source; --ref and --sha apply to a git source`,
			)
		}
		next.source = {
			...entry.source,
			...(change.ref === undefined ? {} : { ref: change.ref }),
			...(change.sha === undefined ? {} : { sha: change.sha }),
		}
	}

	for (const [field, value] of Object.entries(change.metadata)) {
		if (target === 'codex' && !CODEX_FIELDS.includes(field)) continue
		next[field] = value
	}
	for (const field of change.unset) {
		if ((PINS as readonly string[]).includes(field)) {
			if (isGitSource(next.source)) {
				const { [field]: _removed, ...rest } = next.source
				next.source = rest
			}
		} else {
			delete next[field]
		}
	}
	return { entry: next }
}

interface PlannedTarget {
	target: MarketplaceTarget
	catalogPath: string
	file: string
	existing?: string
	/** What the catalog will say; absent when nothing is written to it. */
	content?: string
	/** The entry's source after the change, or as it stands when the entry is left alone. */
	source?: unknown
	skipped?: string
}

/** Reads the catalogs as they would be once `writes` landed, so validation sees the result before
 *  anything is written. */
function overlay(fs: MarketplaceFs, writes: Map<string, string>): MarketplaceFs {
	return {
		...fs,
		exists: (file) => writes.has(file) || fs.exists(file),
		read: (file) => writes.get(file) ?? fs.read(file),
	}
}

function issueKey(file: string, issue: CatalogIssue): string {
	return `${file}\0${issue.path}\0${issue.message}`
}

/** Changes one entry already listed in this repository's catalogs, in place.
 *
 *  `marketplace add --force` replaces an entry with what it can derive, which drops anything it
 *  cannot: a `category`, an `author`, a field a curator wrote by hand. This keeps every field the
 *  request does not name, and changes only the ones it does — the source, a pin, one field.
 *
 *  The result is validated before anything is written. An update that would leave a catalog with a
 *  problem it did not have before stops; problems that were already there are `validate`'s to report.
 *  Nothing is fetched and nothing is published. */
export function updateMarketplaceEntry(
	rootInput: string,
	name: string,
	opts: MarketplaceUpdateOptions = {},
	fs: MarketplaceFs = realMarketplaceFs,
): MarketplaceUpdateResult[] {
	const root = path.resolve(rootInput)
	assertMarketplaceName(name, 'plugin name')
	const change = readChange(opts)
	const targets = selectedTargets(opts.targets)

	const planned: PlannedTarget[] = targets.map((target) => {
		const catalogPath = TARGET_CATALOG_PATHS[target]
		const file = path.join(root, catalogPath)
		if (!fs.exists(file)) return { target, catalogPath, file, skipped: `no catalog at ${catalogPath}` }
		const existing = fs.read(file)
		const entry = findCatalogEntry(existing, catalogPath, name)
		if (entry === undefined) {
			return { target, catalogPath, file, existing, skipped: `"${name}" is not listed in ${catalogPath}` }
		}
		const changed = changeEntry(target, catalogPath, entry, change)
		if ('omitted' in changed) {
			return {
				target,
				catalogPath,
				file,
				existing,
				source: entry.source,
				skipped: `${changed.omitted}; "${name}" keeps its current source in ${catalogPath}`,
			}
		}
		return {
			target,
			catalogPath,
			file,
			existing,
			source: changed.entry.source,
			content: replaceCatalogEntry(existing, catalogPath, changed.entry),
		}
	})

	if (!planned.some((entry) => entry.source !== undefined)) {
		throw new Error(`error: "${name}" is not listed in any selected catalog; list it with marketplace add`)
	}

	// Copilot CLI and Cursor read the Claude catalog when they have none of their own. A new source in
	// that file that one of them cannot install would break it there, so it gets a catalog of its own
	// without the entry — the same shield `add` writes.
	const claude = planned.find((entry) => entry.target === 'claude')
	if (claude?.content !== undefined && !sameCatalogContent(claude.existing as string, claude.content)) {
		for (const entry of planned) {
			if (entry.existing !== undefined || (entry.target !== 'copilot' && entry.target !== 'cursor')) continue
			const omitted = adaptCatalogContent(entry.target, claude.content).omitted
			if (!omitted.some((item) => item.name === name)) continue
			entry.content = deriveSharedCatalog(entry.target, claude.content)
			entry.skipped = `${entry.skipped}, and ${entry.target} reads the Claude one, where "${name}" now has a source it cannot install; wrote ${entry.catalogPath} without it`
		}
	}

	const changed = planned.filter(
		(entry) =>
			entry.content !== undefined &&
			(entry.existing === undefined || !sameCatalogContent(entry.existing, entry.content)),
	)
	const writes = new Map(changed.map((entry) => [entry.file, entry.content as string]))
	const before = validateMarketplace(root, { targets }, fs)
	const after = validateMarketplace(root, { targets }, overlay(fs, writes))
	const known = new Set(before.flatMap((row) => row.issues.map((issue) => issueKey(row.path, issue))))
	const introduced = after
		.map((row) => ({ path: row.path, issues: row.issues.filter((issue) => !known.has(issueKey(row.path, issue))) }))
		.filter((row) => row.issues.length > 0)
	if (introduced.length > 0) {
		throw new Error(introduced.map((row) => formatCatalogIssues(row.path, row.issues)).join('\n'))
	}

	const results = planned.map((entry): MarketplaceUpdateResult => {
		const row = {
			target: entry.target,
			entry: name,
			source: entry.source === undefined ? '-' : describeSource(entry.source as string | CatalogSource),
			path: entry.catalogPath,
		}
		if (entry.skipped !== undefined) return { ...row, status: 'skipped', reason: entry.skipped }
		if (!changed.includes(entry)) return { ...row, status: 'unchanged' }
		return { ...row, status: opts.dryRun ? 'planned' : 'updated' }
	})

	if (!opts.dryRun) for (const [file, content] of writes) fs.writeAtomically(file, content)
	return results
}

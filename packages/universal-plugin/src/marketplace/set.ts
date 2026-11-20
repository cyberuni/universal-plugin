import * as path from 'node:path'

import { selectedTargets } from './add.js'
import { type MarketplaceFs, realMarketplaceFs } from './fs.js'
import {
	assertMarketplaceName,
	editCatalogTopLevel,
	type MarketplaceTarget,
	readCatalogTopLevel,
	sameCatalogContent,
	TARGET_CATALOG_PATHS,
} from './marketplace.js'
import { introducedIssues } from './validate.js'
import { formatCatalogIssues } from './validation.js'

const ALLOWLIST = 'allowCrossMarketplaceDependenciesOn'

/** The top-level fields `--unset` removes. `owner` and `name` stay: every Claude-shaped catalog needs
 *  both. */
export const SET_UNSET_FIELDS = ['description', 'owner.email', 'owner.url', ALLOWLIST] as const

type UnsetField = (typeof SET_UNSET_FIELDS)[number]

export interface MarketplaceSetOptions {
	targets?: MarketplaceTarget[]
	/** Marketplaces to add to `allowCrossMarketplaceDependenciesOn`. */
	allowDependenciesOn?: string[]
	/** Marketplaces to take out of `allowCrossMarketplaceDependenciesOn`. */
	disallowDependenciesOn?: string[]
	description?: string
	owner?: string
	ownerEmail?: string
	ownerUrl?: string
	unset?: string[]
	dryRun?: boolean
}

export type MarketplaceSetStatus = 'updated' | 'unchanged' | 'planned' | 'skipped'

export interface MarketplaceSetResult {
	target: MarketplaceTarget
	status: MarketplaceSetStatus
	path: string
	/** The top-level fields this run names for the catalog, `-` when it names none. */
	fields: string
	reason?: string
}

interface CatalogChange {
	allow: string[]
	disallow: string[]
	description?: string
	owner: { name?: string; email?: string; url?: string }
	unset: UnsetField[]
}

/** Which runtimes carry each field. Claude Code is the one runtime that resolves plugin
 *  dependencies, so only its catalog carries the allowlist. Codex's catalog states no owner and no
 *  description; it has a display name under `interface` instead (`.research/local-marketplaces`). */
function carries(target: MarketplaceTarget, field: 'description' | 'owner' | typeof ALLOWLIST): boolean {
	if (target === 'codex') return false
	return field === ALLOWLIST ? target === 'claude' : true
}

function readChange(opts: MarketplaceSetOptions): CatalogChange {
	const allow = [...new Set(opts.allowDependenciesOn ?? [])]
	const disallow = [...new Set(opts.disallowDependenciesOn ?? [])]
	for (const name of [...allow, ...disallow]) assertMarketplaceName(name, 'marketplace name')
	const both = allow.find((name) => disallow.includes(name))
	if (both !== undefined) throw new Error(`error: marketplace "${both}" is both allowed and disallowed`)

	const unset = [...new Set(opts.unset ?? [])]
	for (const field of unset) {
		if (!(SET_UNSET_FIELDS as readonly string[]).includes(field)) {
			throw new Error(`error: --unset takes one of ${SET_UNSET_FIELDS.join(', ')}, not "${field}"`)
		}
	}
	const set = [
		...(opts.description === undefined ? [] : ['description']),
		...(opts.ownerEmail === undefined ? [] : ['owner.email']),
		...(opts.ownerUrl === undefined ? [] : ['owner.url']),
		...(allow.length === 0 ? [] : [ALLOWLIST]),
	]
	const contradicted = set.find((field) => unset.includes(field as UnsetField))
	if (contradicted !== undefined) throw new Error(`error: "${contradicted}" is both set and unset`)
	if (opts.owner !== undefined && opts.owner.trim() === '') throw new Error('error: --owner must not be empty')

	const change: CatalogChange = {
		allow,
		disallow,
		description: opts.description,
		owner: { name: opts.owner, email: opts.ownerEmail, url: opts.ownerUrl },
		unset: unset as UnsetField[],
	}
	if (
		allow.length === 0 &&
		disallow.length === 0 &&
		change.description === undefined &&
		Object.values(change.owner).every((value) => value === undefined) &&
		unset.length === 0
	) {
		throw new Error(
			'error: nothing to change; pass --allow-dependencies-on, --disallow-dependencies-on, --description, --owner, --owner-email, --owner-url, or --unset',
		)
	}
	return change
}

/** The fields the change names for one target, and the catalog as it reads afterwards. */
function applyChange(
	target: MarketplaceTarget,
	catalogPath: string,
	content: string,
	change: CatalogChange,
): { fields: string[]; content: string } {
	const catalog = readCatalogTopLevel(content, catalogPath)
	const set: Record<string, unknown> = {}
	const unset: string[] = []
	const fields: string[] = []

	if (carries(target, 'description')) {
		if (change.description !== undefined) {
			set.description = change.description
			fields.push('description')
		} else if (change.unset.includes('description')) {
			unset.push('description')
			fields.push('description')
		}
	}

	if (carries(target, 'owner')) {
		const named = Object.entries(change.owner).filter(([, value]) => value !== undefined)
		const dropped = change.unset.filter((field) => field.startsWith('owner.')).map((field) => field.slice(6))
		if (named.length > 0 || dropped.length > 0) {
			const current =
				typeof catalog.owner === 'object' && catalog.owner !== null && !Array.isArray(catalog.owner)
					? { ...(catalog.owner as Record<string, unknown>) }
					: {}
			for (const [key, value] of named) current[key] = value
			for (const key of dropped) delete current[key]
			set.owner = current
			fields.push('owner')
		}
	}

	if (
		carries(target, ALLOWLIST) &&
		(change.allow.length > 0 || change.disallow.length > 0 || change.unset.includes(ALLOWLIST))
	) {
		fields.push(ALLOWLIST)
		const current = Array.isArray(catalog[ALLOWLIST]) ? (catalog[ALLOWLIST] as unknown[]) : []
		const next = change.unset.includes(ALLOWLIST)
			? []
			: [
					...current.filter((name) => !change.disallow.includes(name as string)),
					...change.allow.filter((name) => !current.includes(name)),
				]
		// An empty allowlist says what no allowlist says, so the key goes rather than staying as `[]`.
		if (next.length === 0) unset.push(ALLOWLIST)
		else set[ALLOWLIST] = next
	}

	return { fields, content: editCatalogTopLevel(content, catalogPath, set, unset) }
}

/** Sets or changes a catalog's own fields — its owner, its description, and the marketplaces its
 *  plugins may depend on — in every selected catalog that carries the field, together.
 *
 *  `marketplace init --force` is the only other route to these fields, and it regenerates the whole
 *  catalog. This edits the top level in place: the entries, every other top-level field, and the
 *  key order stay as they were. Each runtime gets only the fields its catalog carries.
 *
 *  The result is validated before anything is written, as `update` validates. Nothing is fetched and
 *  nothing is published. */
export function setMarketplaceFields(
	rootInput: string,
	opts: MarketplaceSetOptions = {},
	fs: MarketplaceFs = realMarketplaceFs,
): MarketplaceSetResult[] {
	const root = path.resolve(rootInput)
	const change = readChange(opts)
	const targets = selectedTargets(opts.targets)

	const planned = targets.map((target) => {
		const catalogPath = TARGET_CATALOG_PATHS[target]
		const file = path.join(root, catalogPath)
		if (!fs.exists(file)) return { target, catalogPath, file, fields: [], skipped: `no catalog at ${catalogPath}` }
		const existing = fs.read(file)
		const applied = applyChange(target, catalogPath, existing, change)
		if (applied.fields.length === 0) {
			return {
				target,
				catalogPath,
				file,
				fields: [],
				skipped: `${catalogPath} carries none of the fields this run sets`,
			}
		}
		return {
			target,
			catalogPath,
			file,
			fields: applied.fields,
			changed: !sameCatalogContent(existing, applied.content),
			content: applied.content,
		}
	})

	if (!planned.some((entry) => entry.content !== undefined)) {
		throw new Error('error: no selected catalog carries the fields this run sets; create one with marketplace init')
	}

	const writes = new Map(
		planned.filter((entry) => entry.changed).map((entry) => [entry.file, entry.content as string] as const),
	)
	const introduced = introducedIssues(root, targets, writes, fs)
	if (introduced.length > 0) {
		throw new Error(introduced.map((row) => formatCatalogIssues(row.path, row.issues)).join('\n'))
	}

	const results = planned.map((entry): MarketplaceSetResult => {
		const row = { target: entry.target, path: entry.catalogPath, fields: entry.fields.join(' ') || '-' }
		if (entry.skipped !== undefined) return { ...row, status: 'skipped', reason: entry.skipped }
		if (!entry.changed) return { ...row, status: 'unchanged' }
		return { ...row, status: opts.dryRun ? 'planned' : 'updated' }
	})

	if (!opts.dryRun) for (const [file, content] of writes) fs.writeAtomically(file, content)
	return results
}

import * as path from 'node:path'

import { catalogDependencyIssues, withoutQualifiedOn } from '../dependencies/dependencies.js'
import { type MarketplaceFs, realMarketplaceFs } from './fs.js'
import { catalogResolution, type MarketplaceTarget, TARGET_CATALOG_PATHS } from './marketplace.js'
import { type CatalogIssue, validateCatalogContent } from './validation.js'

export interface MarketplaceValidateOptions {
	targets?: MarketplaceTarget[]
	/** Require every selected target to carry a catalog, rather than reporting a missing one. */
	required?: boolean
}

export interface CatalogValidation {
	target: MarketplaceTarget
	path: string
	status: 'valid' | 'invalid' | 'missing'
	issues: CatalogIssue[]
}

/** A `./`-prefixed source names a directory inside the repository, and Claude Code resolves it
 *  against the directory holding `.claude-plugin/`. A source pointing nowhere passes every schema
 *  check and still installs nothing, so the on-disk check belongs here rather than in the rules. */
function checkSources(root: string, fs: MarketplaceFs, catalog: unknown): CatalogIssue[] {
	if (typeof catalog !== 'object' || catalog === null) return []
	const plugins = (catalog as Record<string, unknown>).plugins
	if (!Array.isArray(plugins)) return []
	const issues: CatalogIssue[] = []
	plugins.forEach((entry, index) => {
		if (typeof entry !== 'object' || entry === null) return
		const source = (entry as Record<string, unknown>).source
		const location =
			typeof source === 'string'
				? source
				: typeof source === 'object' && source !== null
					? (source as Record<string, unknown>).path
					: undefined
		if (typeof location !== 'string' || !location.startsWith('./')) return
		if (!fs.exists(path.join(root, location))) {
			issues.push({ path: `plugins[${index}].source`, message: `points at "${location}", which does not exist` })
		}
	})
	return issues
}

const UP_NAMESPACE = 'org.cyberuni.universal-plugin'

function readJsonObject(fs: MarketplaceFs, file: string): Record<string, unknown> | undefined {
	if (!fs.exists(file)) return undefined
	try {
		const parsed = JSON.parse(fs.read(file))
		return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : undefined
	} catch {
		return undefined
	}
}

/** The dependencies a plugin kept in this repository declares, read from the files on disk: the
 *  derived `.claude-plugin/plugin.json` Claude Code loads, or — before a build has written it — the
 *  canonical declaration under the universal-plugin extension. */
function localPluginDependencies(fs: MarketplaceFs, pluginRoot: string): unknown {
	const derived = readJsonObject(fs, path.join(pluginRoot, '.claude-plugin', 'plugin.json'))
	if (derived !== undefined) return derived.dependencies
	const canonical = readJsonObject(fs, path.join(pluginRoot, 'plugin.json'))
	const extension = (canonical?.extensions as Record<string, Record<string, unknown>> | undefined)?.[UP_NAMESPACE]
	const harness = (extension?.harnesses as Record<string, Record<string, unknown>> | undefined)?.['claude-code']
	return harness?.dependencies ?? extension?.dependencies
}

/** Claude Code resolves a plain dependency name through the catalog its dependent was installed
 *  from, so it must be listed there; a name qualified with another marketplace must be allowed in
 *  `allowCrossMarketplaceDependenciesOn`, or that plugin does not install. A name qualified with this
 *  catalog's own name is left alone. Only what is readable
 *  offline is checked — an entry's own `dependencies`, and the manifest of a plugin at a `./` path. */
function checkDependencies(
	root: string,
	fs: MarketplaceFs,
	catalog: unknown,
	content: string,
	file: string,
): CatalogIssue[] {
	if (typeof catalog !== 'object' || catalog === null) return []
	const plugins = (catalog as Record<string, unknown>).plugins
	if (!Array.isArray(plugins)) return []
	const resolution = { path: file, ...catalogResolution(content) }
	const issues: CatalogIssue[] = []
	plugins.forEach((entry, index) => {
		if (typeof entry !== 'object' || entry === null) return
		const record = entry as Record<string, unknown>
		const reported = new Set<string>()
		const report = (issuePath: string, declaration: unknown) => {
			const checked = withoutQualifiedOn(declaration, resolution.name)
			for (const message of catalogDependencyIssues(checked, resolution)) {
				if (reported.has(message)) continue
				reported.add(message)
				issues.push({ path: issuePath, message })
			}
		}
		report(`plugins[${index}].dependencies`, record.dependencies)
		if (typeof record.source === 'string' && record.source.startsWith('./')) {
			report(`plugins[${index}].source`, localPluginDependencies(fs, path.join(root, record.source)))
		}
	})
	return issues
}

/** Checks the catalogs a repository carries against the shape each runtime loads. Reads only; it
 *  repairs nothing, because a catalog someone hand-edited is theirs to correct. */
export function validateMarketplace(
	rootInput: string,
	opts: MarketplaceValidateOptions = {},
	fs: MarketplaceFs = realMarketplaceFs,
): CatalogValidation[] {
	const root = path.resolve(rootInput)
	const targets =
		opts.targets && opts.targets.length > 0
			? [...new Set(opts.targets)]
			: (['claude', 'codex', 'copilot', 'cursor'] as MarketplaceTarget[])

	return targets.map((target) => {
		const relative = TARGET_CATALOG_PATHS[target]
		const file = path.join(root, relative)
		if (!fs.exists(file)) {
			return {
				target,
				path: relative,
				status: opts.required ? 'invalid' : 'missing',
				issues: opts.required ? [{ path: '', message: 'no catalog at this path' }] : [],
			}
		}
		const content = fs.read(file)
		const issues = [
			...validateCatalogContent(target, content),
			...parseAndCheck(content, (parsed) => [
				...checkSources(root, fs, parsed),
				// Claude Code is the only runtime that reads plugin dependencies, and it reads this catalog.
				...(target === 'claude' ? checkDependencies(root, fs, parsed, content, relative) : []),
			]),
		]
		return { target, path: relative, status: issues.length === 0 ? 'valid' : 'invalid', issues }
	})
}

function parseAndCheck(content: string, check: (parsed: unknown) => CatalogIssue[]): CatalogIssue[] {
	let parsed: unknown
	try {
		parsed = JSON.parse(content)
	} catch {
		return []
	}
	return check(parsed)
}

import * as path from 'node:path'

import { type MarketplaceFs, realMarketplaceFs } from './fs.js'
import { type MarketplaceTarget, TARGET_CATALOG_PATHS } from './marketplace.js'
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
		const issues = [...validateCatalogContent(target, content), ...parseAndCheckSources(root, fs, content)]
		return { target, path: relative, status: issues.length === 0 ? 'valid' : 'invalid', issues }
	})
}

function parseAndCheckSources(root: string, fs: MarketplaceFs, content: string): CatalogIssue[] {
	try {
		return checkSources(root, fs, JSON.parse(content))
	} catch {
		return []
	}
}

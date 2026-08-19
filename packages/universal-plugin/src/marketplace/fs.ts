import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

import { TARGET_CATALOG_PATHS } from './marketplace.js'

export interface MarketplaceFs {
	exists(file: string): boolean
	isDirectory(file: string): boolean
	realpath(file: string): string
	read(file: string): string
	listEntries(dir: string): string[]
	writeAtomically(file: string, content: string): void
}

export const realMarketplaceFs: MarketplaceFs = {
	exists: fs.existsSync,
	isDirectory(file) {
		return fs.statSync(file).isDirectory()
	},
	realpath(file) {
		return fs.realpathSync(file)
	},
	read(file) {
		return fs.readFileSync(file, 'utf8')
	},
	listEntries(dir) {
		return fs.readdirSync(dir)
	},
	writeAtomically(file, content) {
		fs.mkdirSync(path.dirname(file), { recursive: true })
		const temporary = `${file}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`
		fs.writeFileSync(temporary, content)
		fs.renameSync(temporary, file)
	},
}

/** The repository a plugin sits in, and the catalogs that repository already carries — the state
 *  every command that folds an entry into a catalog needs. `undefined` outside a repository, which
 *  is the one case with nowhere to put a catalog. Lives here because the catalogs are marketplace
 *  artifacts: `plugin init` and `plugin build` both read this rather than each walking git.
 */
export interface CatalogRepo {
	/** Absolute path of the repository root. */
	root: string
	/** Where the plugin sits inside it, `/`-separated and empty at the root. */
	pluginPath: string
	/** Catalog contents keyed by their repository-relative path. */
	catalogs: Record<string, string>
}

export function gitToplevel(root: string): string | undefined {
	try {
		const top = execFileSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		}).trim()
		return top === '' ? undefined : path.resolve(top)
	} catch {
		return undefined
	}
}

export function gatherCatalogRepo(root: string): CatalogRepo | undefined {
	const repoRoot = gitToplevel(root)
	if (!repoRoot) return undefined
	const relative = path.relative(repoRoot, root)
	if (relative.startsWith('..') || path.isAbsolute(relative)) return undefined

	const catalogs: Record<string, string> = {}
	for (const catalog of Object.values(TARGET_CATALOG_PATHS)) {
		const file = path.join(repoRoot, catalog)
		if (fs.existsSync(file)) catalogs[catalog] = fs.readFileSync(file, 'utf8')
	}
	return { root: repoRoot, pluginPath: relative.split(path.sep).join('/'), catalogs }
}

import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

import { detectIndent } from '../json.js'
import type { InitPlan, InitState, RepoState } from './init.js'

/** Every repository-root-relative catalog path a vendor reads, so an `init` run folds its entry
 *  into whichever ones already exist. */
const CATALOG_PATHS = [
	'.claude-plugin/marketplace.json',
	'.cursor-plugin/marketplace.json',
	'.agents/plugins/marketplace.json',
	'.github/plugin/marketplace.json',
]

/** Gathers the filesystem state `planInit` needs and applies the plan it returns. The manifest is
 *  written tab-indented (the repo default); `package.json` keeps its own indentation. */
export interface InitFs {
	gather(root: string): InitState
	apply(root: string, plan: InitPlan): void
}

function git(root: string, args: string[]): string | null {
	try {
		return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
	} catch {
		return null
	}
}

/** Where the plugin sits in its repository, and the catalogs that repository already carries.
 *  `null` outside a repository, which is the one case with nowhere to put a catalog. */
function gatherRepo(root: string): RepoState | undefined {
	const top = git(root, ['rev-parse', '--show-toplevel'])
	if (!top) return undefined
	const repoRoot = path.resolve(top)
	const relative = path.relative(repoRoot, root)
	if (relative.startsWith('..') || path.isAbsolute(relative)) return undefined

	const remote = git(root, ['remote', 'get-url', 'origin'])
	const match = remote?.match(/[/:]([^/:]+)\/([^/]+?)(?:\.git)?$/)
	const catalogs: Record<string, string> = {}
	for (const catalog of CATALOG_PATHS) {
		const file = path.join(repoRoot, catalog)
		if (fs.existsSync(file)) catalogs[catalog] = fs.readFileSync(file, 'utf8')
	}
	return {
		pluginPath: relative.split(path.sep).join('/'),
		dirName: path.basename(repoRoot),
		slug: match ? { owner: match[1] as string, repo: match[2] as string } : undefined,
		catalogs,
	}
}

function manifestPath(root: string): string {
	return path.join(root, 'plugin.json')
}

function packageJsonPath(root: string): string {
	return path.join(root, 'package.json')
}

export const realInitFs: InitFs = {
	gather(root) {
		const pj = packageJsonPath(root)
		const packageJson = fs.existsSync(pj) ? (JSON.parse(fs.readFileSync(pj, 'utf8')) as Record<string, unknown>) : null
		return { manifestExists: fs.existsSync(manifestPath(root)), packageJson, repo: gatherRepo(root) }
	},
	apply(root, plan) {
		fs.writeFileSync(manifestPath(root), `${JSON.stringify(plan.manifest, null, '\t')}\n`)
		for (const dir of plan.dirs) {
			fs.mkdirSync(path.join(root, dir), { recursive: true })
		}
		for (const catalog of plan.catalogs) {
			const file = path.join(root, catalog.path)
			fs.mkdirSync(path.dirname(file), { recursive: true })
			fs.writeFileSync(file, catalog.content)
		}
		if (plan.packageJson) {
			const pj = packageJsonPath(root)
			const indent = detectIndent(fs.readFileSync(pj, 'utf8'))
			fs.writeFileSync(pj, `${JSON.stringify(plan.packageJson, null, indent)}\n`)
		}
	},
}

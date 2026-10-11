import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

import { detectIndent } from '../json.js'
import { gatherCatalogRepo } from '../marketplace/fs.js'
import type { ChangesetsState, InitPlan, InitState, RepoState } from './init.js'

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
 *  `undefined` outside a repository, which is the one case with nowhere to put a catalog. The
 *  repository-and-catalogs half is shared with `plugin build`, which refreshes the same files. */
function gatherRepo(root: string): RepoState | undefined {
	const repo = gatherCatalogRepo(root)
	if (!repo) return undefined

	const remote = git(root, ['remote', 'get-url', 'origin'])
	const match = remote?.match(/[/:]([^/:]+)\/([^/]+?)(?:\.git)?$/)
	return {
		pluginPath: repo.pluginPath,
		dirName: path.basename(repo.root),
		slug: match ? { owner: match[1] as string, repo: match[2] as string } : undefined,
		catalogs: repo.catalogs,
	}
}

function manifestPath(root: string): string {
	return path.join(root, 'plugin.json')
}

function packageJsonPath(root: string): string {
	return path.join(root, 'package.json')
}

function readJson(file: string): Record<string, unknown> | null {
	return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>) : null
}

/** The changesets workspace the plugin is released from: the repository root, or the plugin root
 *  outside a repository, when it carries `.changeset/`. */
function gatherChangesets(root: string, repo: RepoState | undefined): ChangesetsState | undefined {
	const pluginPath = repo?.pluginPath ?? ''
	const workspace = pluginPath === '' ? root : path.join(root, ...pluginPath.split('/').map(() => '..'))
	if (!fs.existsSync(path.join(workspace, '.changeset'))) return undefined
	return { pluginPath, packageJson: readJson(packageJsonPath(workspace)) }
}

function writeJson(file: string, value: Record<string, unknown>): void {
	const indent = detectIndent(fs.readFileSync(file, 'utf8'))
	fs.writeFileSync(file, `${JSON.stringify(value, null, indent)}\n`)
}

export const realInitFs: InitFs = {
	gather(root) {
		const repo = gatherRepo(root)
		return {
			manifestExists: fs.existsSync(manifestPath(root)),
			packageJson: readJson(packageJsonPath(root)),
			repo,
			changesets: gatherChangesets(root, repo),
		}
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
		if (plan.packageJson) writeJson(packageJsonPath(root), plan.packageJson)
		if (plan.workspacePackageJson) {
			writeJson(path.join(root, plan.workspacePackageJson.path), plan.workspacePackageJson.content)
		}
	},
}

import { type SpawnSyncOptions, type SpawnSyncReturns, spawnSync } from 'node:child_process'

import { SCRIPT_GLOBAL, type ScriptData } from '../compile/scripts.js'

/** The data `plugin build` embedded in this compiled script. */
export function skillScript(): ScriptData {
	const data = (globalThis as Record<string, unknown>)[SCRIPT_GLOBAL] as ScriptData | undefined
	if (data === undefined) throw new Error('this script runs only as compiled by `plugin build`')
	return data
}

/** Runs the universal-plugin CLI. A skill may be copied away from its package, so it never reaches
 *  for a CLI beside it: the project's installed CLI first, then the one pinned to this script's
 *  version, which `plugin version` stamps. */
export function runCli(
	args: string[],
	options: SpawnSyncOptions & { encoding?: 'utf8' } = {},
): SpawnSyncReturns<string> {
	const { bin, package: pkg, version } = skillScript()
	const name = bin ?? 'universal-plugin'
	const installed = spawnSync('pnpm', ['exec', name, '--version'], { encoding: 'utf8' })
	if (installed.status === 0) return spawnSync('pnpm', ['exec', name, ...args], { encoding: 'utf8', ...options })
	const pinned = `${pkg ?? 'universal-plugin'}@${version ?? 'latest'}`
	return spawnSync('npx', [pinned, ...args], { encoding: 'utf8', ...options })
}

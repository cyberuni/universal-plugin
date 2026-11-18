import { type SpawnSyncOptions, type SpawnSyncReturns, spawnSync } from 'node:child_process'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Runs the universal-plugin CLI through the forwarder `plugin build` writes beside this compiled
 *  script (ADR-0022): the checkout's CLI when the skill sits in one, else the CLI pinned to the
 *  plugin version through `npx`. A skill may be copied away from its package, so the forwarder, not
 *  this script, decides. */
export function runCli(
	args: string[],
	options: SpawnSyncOptions & { encoding?: 'utf8' } = {},
): SpawnSyncReturns<string> {
	const forwarder = path.join(path.dirname(fileURLToPath(import.meta.url)), 'universal-plugin.mjs')
	return spawnSync(process.execPath, [forwarder, ...args], { encoding: 'utf8', ...options })
}

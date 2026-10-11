import * as path from 'node:path'

import { Command } from 'commander'

import { buildPlugin } from '../build/build.js'
import { ROOT_OPTION, resolveRoot } from '../cli-options.js'
import { output } from '../output.js'
import { checkVersionDrift, type DriftResult } from '../version/drift.js'
import { gatherDriftState } from '../version/fs.js'
import { realSyncVersionFs } from './fs.js'
import { syncVersion } from './sync-version.js'

export function publishCommand(): Command {
	const cmd = new Command('publish').description('Prepare plugin for publishing').helpCommand(false)

	cmd
		.command('sync-version')
		.description('Sync version from packagePath/package.json (default: the plugin root) into plugin.json')
		.option('--no-build', 'Skip re-deriving the vendor manifests')
		.addOption(ROOT_OPTION)
		.action((opts: { root?: string; build?: boolean }) => {
			try {
				const root = resolveRoot(opts.root)
				const result = syncVersion(root, realSyncVersionFs)

				// The same re-derivation `plugin version` runs after its bump, so the vendor manifests carry
				// the synced version and the two directions of the version flow cannot drift (#143).
				const derived: string[] = []
				if (opts.build !== false) {
					const build = buildPlugin(root, {})
					for (const warning of build.warnings) {
						process.stderr.write(`warn: ${warning}\n`)
					}
					for (const written of build.written) {
						derived.push(path.relative(root, written).split(path.sep).join('/'))
					}
				}

				output({ ...result, derived }, { version: result.version, manifest: result.manifestPath, derived })
				if (opts.build === false) process.stderr.write('→ universal-plugin plugin build\n')
			} catch (err) {
				process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
				process.exit(1)
			}
		})

	cmd
		.command('check-version')
		.description('Fail when the files that carry the plugin version disagree (read-only, for CI)')
		.option('--format <format>', 'Output format: json or toon (default: toon)')
		.addOption(ROOT_OPTION)
		.addHelpText('after', '\nExample:\n  $ universal-plugin publish check-version --root plugins/my-plugin\n')
		.action((opts: { root?: string }) => {
			try {
				const root = resolveRoot(opts.root)
				const result = checkVersionDrift(gatherDriftState(root))
				const ok = result.drifted.length === 0

				output(
					{ ...result, ok },
					{
						expected: result.expected ?? '(none)',
						source: result.source,
						drifted: result.drifted.map((s) => ({ path: s.path, kind: s.kind, version: s.version ?? '(none)' })),
						summary: `checked ${result.surfaces.length}, drifted ${result.drifted.length}`,
					},
				)
				if (ok) return
				for (const s of result.drifted) {
					process.stderr.write(`${s.path} is ${s.version ?? '(no version)'}, ${result.source} is ${result.expected}\n`)
				}
				process.stderr.write(repairStep(result))
				process.exit(1)
			} catch (err) {
				process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
				process.exit(1)
			}
		})

	return cmd
}

/** The command that owns the first file left behind: the manifest follows the package through
 *  `sync-version` (which re-derives the rest), the derived manifests and catalogs through `build`, and
 *  the skill pins through `bundle`. */
function repairStep(result: DriftResult): string {
	const kinds = new Set(result.drifted.map((s) => s.kind))
	if (kinds.has('manifest')) return '→ universal-plugin publish sync-version\n'
	if (kinds.has('package')) return '→ /universal-plugin:version — the package and the manifest disagree\n'
	if (kinds.has('vendor-manifest') || kinds.has('catalog')) return '→ universal-plugin plugin build\n'
	return '→ universal-plugin plugin bundle\n'
}

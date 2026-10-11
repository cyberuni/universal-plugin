import { Command } from 'commander'

import { ROOT_OPTION, resolveRoot } from '../cli-options.js'
import { output } from '../output.js'
import { runVersion } from '../version/cli.js'
import { checkVersionDrift, type DriftResult } from '../version/drift.js'
import { gatherDriftState } from '../version/fs.js'

export function publishCommand(): Command {
	const cmd = new Command('publish').description('Prepare plugin for publishing').helpCommand(false)

	// Deprecated (#179): `plugin version --from-package` is the same stamp under the command that owns
	// every version-carrying place. Kept as a warning alias for one minor release.
	cmd
		.command('sync-version')
		.description('Deprecated: use `plugin version --from-package`')
		.option('--no-build', 'Skip re-deriving the vendor manifests')
		.option('--format <format>', 'Output format: json or toon (default: toon)')
		.addOption(ROOT_OPTION)
		.action((opts: { root?: string; build?: boolean }) => {
			process.stderr.write(
				'warn: publish sync-version is deprecated and will be removed in the next minor release — use plugin version --from-package\n',
			)
			runVersion(undefined, { ...opts, fromPackage: true })
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

/** The command that carries the number on. Where a package decides it, `plugin version
 *  --from-package` stamps every place and re-derives the vendor manifests and catalogs, so it repairs
 *  every kind at once. Where the manifest decides it, `plugin build` re-derives what it derives, and a
 *  stamped place left behind takes `plugin version` with the same number. A package that disagrees
 *  with the manifest is a release decision, so it goes to the skill. */
function repairStep(result: DriftResult): string {
	if (result.drifted.some((s) => s.kind === 'package')) {
		return '→ /universal-plugin:version — the package and the manifest disagree\n'
	}
	if (result.source !== 'plugin.json') return '→ universal-plugin plugin version --from-package\n'
	if (result.drifted.every((s) => s.kind === 'vendor-manifest' || s.kind === 'catalog')) {
		return '→ universal-plugin plugin build\n'
	}
	return `→ universal-plugin plugin version ${result.expected} --force\n`
}

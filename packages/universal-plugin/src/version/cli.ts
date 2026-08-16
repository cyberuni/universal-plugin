import * as path from 'node:path'

import { Command, Option } from 'commander'

import { buildPlugin } from '../build/build.js'
import { ROOT_OPTION, resolveRoot } from '../cli-options.js'
import { output, printFields, printTable } from '../output.js'
import { realVersionFs, type VersionFs } from './fs.js'
import { planVersion, RELEASE_TYPES } from './version.js'

interface VersionCliOptions {
	preid?: string
	force?: boolean
	/** Commander's `--no-build`: `true` by default, `false` when the flag is passed. */
	build?: boolean
	dryRun?: boolean
	root?: string
}

interface ResultRow {
	path: string
	action: 'updated' | 'derived' | 'planned'
}

export function versionCommand(deps: { fs: VersionFs } = { fs: realVersionFs }): Command {
	const cmd = new Command('version')
		.description('Move the plugin version across every file that carries one')
		.argument('<bump>', `Release type (${RELEASE_TYPES.join(', ')}) or an explicit version (1.4.0)`)

	cmd
		.option('--preid <id>', 'Prerelease identifier for the pre* release types')
		.option('--force', 'Allow a version that does not advance on the current one')
		.option('--no-build', 'Skip re-deriving the vendor manifests')
		.option('--dry-run', 'Print what would be written without writing')
		.option('--format <format>', 'Output format: json or toon (default: toon)')
		.addOption(new Option('--json').hideHelp())
		.addOption(ROOT_OPTION)
		.addHelpText('after', '\nExample:\n  $ universal-plugin plugin version minor\n')
		.action((bump: string, opts: VersionCliOptions) => {
			try {
				const root = resolveRoot(opts.root)
				const plan = planVersion(deps.fs.gather(root), {
					bump,
					preid: opts.preid,
					force: Boolean(opts.force),
				})

				const dryRun = Boolean(opts.dryRun)
				const rows: ResultRow[] = plan.rows.map((r) => ({ path: r.path, action: dryRun ? 'planned' : r.action }))

				if (!dryRun) {
					deps.fs.apply(root, plan)

					// Re-derive rather than re-implement: the per-vendor manifests belong to `plugin build`,
					// so the bump calls that writer instead of becoming a second one for the same files.
					if (opts.build !== false) {
						const result = buildPlugin(root, {})
						for (const warning of result.warnings) {
							process.stderr.write(`warn: ${warning}\n`)
						}
						for (const written of result.written) {
							rows.push({ path: path.relative(root, written).split(path.sep).join('/'), action: 'derived' })
						}
					}
				}

				const jsonResult = {
					from: plan.from,
					to: plan.to,
					dryRun,
					written: dryRun ? [] : rows.map((r) => r.path),
					planned: rows.filter((r) => r.action === 'planned').map((r) => r.path),
					summary: { updated: plan.summary.updated, derived: rows.filter((r) => r.action === 'derived').length },
				}
				output(jsonResult, () => {
					printFields({ from: plan.from ?? '(none)', to: plan.to })
					printTable(rows, [
						{ label: 'path', get: (r: ResultRow) => r.path },
						{ label: 'action', get: (r: ResultRow) => r.action },
					])
					console.log(
						dryRun
							? `planned ${plan.summary.updated}, updated 0 (dry run)`
							: `updated ${plan.summary.updated}, derived ${jsonResult.summary.derived}`,
					)
				})

				process.stderr.write(nextStep(dryRun, opts.build !== false))
			} catch (err) {
				process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
				process.exit(1)
			}
		})

	return cmd
}

function nextStep(dryRun: boolean, built: boolean): string {
	if (dryRun) return '→ re-run without --dry-run to apply\n'
	return built ? '→ universal-plugin plugin bundle\n' : '→ universal-plugin plugin build\n'
}

import * as path from 'node:path'

import { Command, Option } from 'commander'

import { buildPlugin } from '../build/build.js'
import { ROOT_OPTION, resolveRoot } from '../cli-options.js'
import { output } from '../output.js'
import { realVersionFs, type VersionFs } from './fs.js'
import { planVersion, RELEASE_TYPES } from './version.js'

export interface VersionCliOptions {
	fromPackage?: boolean
	preid?: string
	force?: boolean
	/** Commander's `--no-build`: `true` by default, `false` when the flag is passed. */
	build?: boolean
	dryRun?: boolean
	root?: string
}

interface ResultRow {
	path: string
	action: 'updated' | 'stamped' | 'derived' | 'planned'
}

export function versionCommand(deps: { fs: VersionFs } = { fs: realVersionFs }): Command {
	const cmd = new Command('version')
		.description('Stamp the plugin version into every file that carries one')
		.argument('[bump]', `Release type (${RELEASE_TYPES.join(', ')}) or an explicit version (1.4.0)`)

	cmd
		.option('--from-package', "Take the version the package's package.json already holds (changesets, release-please)")
		.option('--preid <id>', 'Prerelease identifier for the pre* release types')
		.option('--force', 'Allow a version that does not advance on the current one')
		.option('--no-build', 'Skip re-deriving the vendor manifests')
		.option('--dry-run', 'Print what would be written without writing')
		.option('--format <format>', 'Output format: json or toon (default: toon)')
		.addOption(new Option('--json').hideHelp())
		.addOption(ROOT_OPTION)
		.addHelpText(
			'after',
			[
				'',
				'Examples:',
				'  $ universal-plugin plugin version minor            # plain repository: the author picks',
				'  $ universal-plugin plugin version 1.4.0            # semantic-release: prepareCmd',
				'  $ universal-plugin plugin version --from-package   # changesets / release-please',
				'',
			].join('\n'),
		)
		.action((bump: string | undefined, opts: VersionCliOptions) => runVersion(bump, opts, deps.fs))

	return cmd
}

/** Stamps the version and re-derives the manifests. Shared with the deprecated `publish
 *  sync-version`, which is `--from-package` under its old name. */
export function runVersion(bump: string | undefined, opts: VersionCliOptions, versionFs: VersionFs = realVersionFs) {
	try {
		const root = resolveRoot(opts.root)
		const plan = planVersion(versionFs.gather(root), {
			...(bump === undefined ? {} : { bump }),
			fromPackage: Boolean(opts.fromPackage),
			...(opts.preid === undefined ? {} : { preid: opts.preid }),
			force: Boolean(opts.force),
		})

		const dryRun = Boolean(opts.dryRun)
		const rows: ResultRow[] = plan.rows.map((r) => ({ path: r.path, action: dryRun ? 'planned' : r.action }))
		for (const warning of plan.warnings) process.stderr.write(`warn: ${warning}\n`)

		if (!dryRun) {
			versionFs.apply(root, plan)

			// Re-derive rather than re-implement: the per-vendor manifests belong to `plugin build`,
			// so the stamp calls that writer instead of becoming a second one for the same files.
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

		const derived = rows.filter((r) => r.action === 'derived').length
		const jsonResult = {
			from: plan.from,
			to: plan.to,
			dryRun,
			written: dryRun ? [] : rows.map((r) => r.path),
			planned: rows.filter((r) => r.action === 'planned').map((r) => r.path),
			pins: plan.pins,
			summary: { updated: plan.summary.updated, stamped: plan.summary.stamped, derived },
		}
		output(jsonResult, {
			from: plan.from ?? '(none)',
			to: plan.to,
			files: rows.map((r: ResultRow) => ({ path: r.path, action: r.action })),
			summary: dryRun
				? `planned ${plan.rows.length}, updated 0 (dry run)`
				: `updated ${plan.summary.updated}, stamped ${plan.summary.stamped}, derived ${derived}`,
		})

		process.stderr.write(nextStep(dryRun, opts.build !== false))
	} catch (err) {
		process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
		process.exit(1)
	}
}

function nextStep(dryRun: boolean, built: boolean): string {
	if (dryRun) return '→ re-run without --dry-run to apply\n'
	return built ? '→ review and commit the stamped files\n' : '→ universal-plugin plugin build\n'
}
